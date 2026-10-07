# Puesta en marcha (Firebase + Vercel)

Arquitectura: la página (`index.html`, `panel.html` y sus `.js`) se publica en **Vercel** como sitio estático y habla directamente con **Firestore** y **Firebase Auth**.
No hay servidor propio: la seguridad la dan `firestore.rules` y el inicio de sesión. Plan gratuito de Firebase suficiente. **No envía correos.**

| Quién | Cómo entra | Qué puede |
|---|---|---|
| Jefe de área | **Entrar con Google** (cuenta `@usil.edu.pe` verificada). **Solo en modo prueba** también puede entrar escribiendo su correo, sin verificarlo | Crear solicitudes a su nombre y leer solo las suyas |
| HRBP | Pantalla de inicio → correo y clave propios (van directo a su panel) | Ver y gestionar solo lo que llega a su correo |
| Gerencia | Pantalla de inicio → correo y clave propios (van directo a su panel) | Ver lo que los HRBP le pasan y decidir |

## A. Probar en tu computador (sin nube, sin datos reales)
Necesitas Node 20+ y Java. Una vez: `npm install`. Luego, en **tres terminales** dentro de la carpeta del proyecto:
```bash
npm run emu          # 1) emuladores de Firebase (Auth y Firestore)
npm run seed:local   # 2) datos inventados; imprime las claves de hrbp1@usil.edu.pe y ger1@usil.edu.pe
npm run serve        # 3) la app en http://localhost:5000/?emu
```
- Entra con «Entrar con Google»: en la ventana del emulador elige **Add new account** y usa un correo `@usil.edu.pe` cualquiera. Ese correo no existe de verdad.
- Rellena y envía una solicitud (en modo prueba hay botones para rellenarla). Todas llegan a `hrbp1@usil.edu.pe`.
- Abre `http://localhost:5000/panel.html` y entra con esa cuenta y la clave que imprimió el paso 2; pásala a Gerencia, entra como `ger1@usil.edu.pe` y apruébala.
- Al cerrar los emuladores todo se borra. `?emu` solo funciona en `localhost` y no toca la nube.
- `npm test` (estáticas) y `npm run test:rules` (reglas de seguridad) corren con los emuladores.

## B. Crear el proyecto en Firebase (una vez)
1. https://console.firebase.google.com → **Agregar proyecto** (sin Google Analytics).
2. **Authentication → Método de acceso**: habilita **Google** y **Correo electrónico/contraseña**. «Anónimo» solo si vas a probar el ingreso por correo (modo prueba); **déjalo apagado en producción**.
   En **Configuración → Acciones del usuario**, **desmarca «Habilitar la creación (registro)»**: las cuentas de HRBP y Gerencia las crea solo el script de carga.
3. **Firestore Database → Crear base de datos** (modo producción; región `southamerica-east1`).
4. Pestaña **Reglas**: pega todo `firestore.rules` y **Publicar**.
5. **⚙ Configuración del proyecto → Tus apps → Web (`</>`)**: copia el bloque `firebaseConfig` a `firebase.js` (no es secreto).

## C. Cargar datos y usuarios reales (una vez)
1. **⚙ → Cuentas de servicio → Generar nueva clave privada**. Guarda el JSON **fuera del repositorio**.
2. Copia `tools/usuarios.ejemplo.txt` como `tools/usuarios.json` (correos sin tildes ni ñ, claves de 12+ caracteres, roles) y `tools/ruteo.ejemplo.txt` como `tools/ruteo.local.json` (HRBP de cada departamento). Ambos quedan fuera de GitHub.
3. Genera el CSV del Maestro: `python tools/preparar-maestro.py "Maestro BPs.xlsx" Maestro_recortado.csv`.
4. En PowerShell:
```powershell
cd tools; npm install
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\ruta\clave-de-servicio.json"
node cargar-datos.js ..\Maestro_recortado.csv
```
Es repetible: vuelve a ejecutarlo para cambiar claves o ruteo. `--borrar-solicitudes` vacía las solicitudes (útil al terminar las pruebas).

## D. Publicar en Vercel
1. Repositorio de GitHub **privado**. Cuenta de Vercel con plan **Pro** (el plan Hobby es solo uso personal).
2. Vercel → **Add New → Project** → importa el repositorio. Ajustes: *Framework Preset* **Other**, *Build Command* vacío, *Output Directory* `.` (raíz).
3. `vercel.json` aplica las cabeceras de seguridad (CSP, HSTS, anti-iframe, nosniff, COOP para el popup de Google) y `.vercelignore` deja fuera `tools`, `tests`, `docs` y `firestore.rules`.
4. Con la URL de Vercel (p. ej. `proyecto.vercel.app`):
   - Firebase → **Authentication → Configuración → Dominios autorizados**: agrégala.
   - Google Cloud → **Credenciales** → clave de API de Firebase: restringe a esa URL (referentes HTTP).
5. Cada `git push` a `main` publica de nuevo.

## Salir de pruebas
- **Modo prueba = ingreso solo con correo.** Mientras `config/app.modoPrueba` sea `true`, quien escriba un correo `@usil.edu.pe` entra sin verificarlo y puede enviar solicitudes a nombre de otro. Úsalo solo con el Maestro de **prueba**, nunca con personas reales cargadas.
- Al poner `modoPrueba` en `false` las reglas cierran ese ingreso solas: solo queda Google (y correo y clave para HRBP y Gerencia).
- En Firestore, documento `config/app`: `modoPrueba` → `false` (cierra la lectura en lista del Maestro).
- En `app.js`: `CONFIG.modoPrueba:false` y `camposObligatorios:true`.
- Pon el ruteo real en `tools/ruteo.local.json` y cambia las claves de prueba de los HRBP (vuelve a ejecutar la carga).

## Seguridad (qué hay y qué no)
- **En el repositorio no hay** correos, nombres, matrículas, claves, planillas ni claves de servicio (`npm test` lo verifica). Lo personal vive en Firestore y en archivos locales ignorados por Git.
- `firebase.js` contiene la configuración web de Firebase: es pública por diseño. Lo que protege los datos son `firestore.rules` y los inicios de sesión.
- **Cualquier página web se puede descargar**: Vercel (Pro) no limita quién la carga salvo con Password Protection (clave compartida, de pago). Lo que se descarga no sirve sin una cuenta `@usil.edu.pe` verificada o una clave de HRBP. Si TI exige que la página solo cargue dentro de USIL, hay que alojarla detrás de su inicio de sesión (SharePoint, Azure con Entra ID).
- Scripts en archivos propios y CSP sin scripts inline. Los módulos de Firebase vienen de `gstatic.com`, fijados a una versión, sin SRI (los módulos ES no lo admiten).
- Recomendado: activar **App Check** en Firebase.
- Archiva la implementación antigua de Apps Script (Implementar → Administrar) y borra su hoja si ya no se usa.

## Límites conocidos
- Sin correos: nadie recibe aviso; el HRBP debe abrir el panel.
- Los jefes no tienen bandeja propia ni pueden corregir una solicitud «Devuelta al jefe».
- Sin Cloud Functions no hay límite de envíos por persona; si hay abuso, activar App Check.

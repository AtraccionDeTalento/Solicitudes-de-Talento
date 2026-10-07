# Puesta en marcha (Firebase + Vercel)

Arquitectura: la página (`index.html`, `panel.html` y sus `.js`) se publica en **Vercel** como sitio estático y habla directamente con **Firestore** y **Firebase Auth**.
No hay servidor propio: la seguridad la dan `firestore.rules` y el inicio de sesión. Plan gratuito de Firebase suficiente. **No envía correos y no guarda correos.**

## Cómo se entra: solo con el DNI
Un único campo. El DNI no se guarda ni se envía: la página lo convierte (SHA-256, ver `dni.mjs`) en una cuenta opaca de Firebase. El administrador crea esas cuentas con `tools/cargar-datos.js`.

| Quién | Qué pasa al escribir su DNI | Qué puede |
|---|---|---|
| Jefe de área (cualquier activo del Maestro) | Entra al formulario con su nombre y cargo ya rellenados | Crear solicitudes y leer solo las suyas |
| Business Partner | Va directo a su panel | Ver y gestionar solo lo que llega a él |
| Gerencia (Karla) | Va directo a su panel | Ver lo que los BP le pasan y decidir |
| DNI desconocido | «DNI no autorizado» (igual que uno no autorizado: no revela quién está en la base) | Nada |

> **Riesgo asumido:** el DNI identifica pero **no es un secreto**. Quien conozca el DNI de una persona puede entrar como ella; si es el de un BP o de Gerencia, puede ver y decidir solicitudes. Si TI lo objeta, la salida es sumar una clave (solo a BP y Gerencia) sin cambiar el resto.

## A. Probar en tu computador (sin nube, sin datos reales)
Necesitas Node 22+ y Java. Una vez: `npm install`. Luego, en **tres terminales** dentro de la carpeta del proyecto:
```bash
npm run emu          # 1) emuladores de Firebase (Auth y Firestore)
npm run seed:local   # 2) datos inventados
npm run serve        # 3) la app en http://localhost:5000/?emu
```
DNI de prueba: **jefes** `70000001` a `70000096` · **Business Partner** `80000001` · **Gerencia** `80000002`.
- Entra con un DNI de jefe, rellena y envía una solicitud (en modo prueba hay botones para rellenarla). Todas llegan al BP de prueba.
- Sal y entra con `80000001` (te lleva al panel); pásala a Gerencia; entra con `80000002` y apruébala.
- Al cerrar los emuladores todo se borra. `?emu` solo funciona en `localhost` y no toca la nube.
- `npm test` (estáticas) y `npm run test:rules` (reglas de seguridad) corren con los emuladores.

## B. Crear el proyecto en Firebase (una vez)
1. https://console.firebase.google.com → **Agregar proyecto** (sin Google Analytics).
2. **Authentication → Método de acceso**: habilita **solo «Correo electrónico/contraseña»** (es el mecanismo interno de las cuentas de DNI). Nada de Google ni Anónimo.
   En **Configuración → Acciones del usuario**, **desmarca «Habilitar la creación (registro)»** y deja activada la **protección contra enumeración de correos**.
3. **Firestore Database → Crear base de datos** (modo producción; región `southamerica-east1`).
4. Pestaña **Reglas**: pega todo `firestore.rules` y **Publicar**.
5. **⚙ Configuración del proyecto → Tus apps → Web (`</>`)**: copia el bloque `firebaseConfig` a `firebase.js` (no es secreto).

## C. Cargar datos y accesos reales (una vez)
1. **⚙ → Cuentas de servicio → Generar nueva clave privada**. Guarda el JSON **fuera del repositorio**.
2. Copia `tools/usuarios.ejemplo.txt` como `tools/usuarios.json` (DNI de cada BP y de Karla con su rol) y `tools/ruteo.ejemplo.txt` como `tools/ruteo.local.json` (BP de cada departamento, con su DNI). Ambos quedan fuera de GitHub.
3. Genera el CSV del Maestro: `python tools/preparar-maestro.py "Maestro BPs.xlsx" Maestro_recortado.csv`. Incluye el DNI de cada persona: **bórralo cuando termines**.
4. En PowerShell:
```powershell
cd tools; npm install
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\ruta\clave-de-servicio.json"
node cargar-datos.js ..\Maestro_recortado.csv
```
Crea una cuenta opaca por cada persona activa (unas miles: tarda unos minutos). Es repetible. `--borrar-solicitudes` vacía las solicitudes (útil al terminar las pruebas).
Cuando llegue personal nuevo, vuelve a ejecutarlo con el Maestro actualizado.

## D. Publicar en Vercel
1. Repositorio de GitHub **privado**. Cuenta de Vercel con plan **Pro** (el plan Hobby es solo uso personal).
2. Vercel → **Add New → Project** → importa el repositorio. Ajustes: *Framework Preset* **Other**, *Build Command* vacío, *Output Directory* `.` (raíz).
3. `vercel.json` aplica las cabeceras de seguridad (CSP, HSTS, anti-iframe, nosniff) y `.vercelignore` deja fuera `tools`, `tests`, `docs` y `firestore.rules`.
4. Google Cloud → **Credenciales** → clave de API de Firebase: restringe a la URL de Vercel (referentes HTTP). Firebase → **Authentication → Configuración → Dominios autorizados**: agrégala.
5. Cada `git push` a `main` publica de nuevo.

## Salir de pruebas
- En Firestore, documento `config/app`: `modoPrueba` → `false` (cierra la lectura en lista del Maestro).
- En `app.js`: `CONFIG.modoPrueba:false` y `camposObligatorios:true`.
- Pon el ruteo real en `tools/ruteo.local.json` y vuelve a ejecutar la carga.

## Seguridad (qué hay y qué no)
- **En el repositorio no hay** correos, DNI, nombres, matrículas, claves, planillas ni claves de servicio (`npm test` lo verifica). En Firestore no hay correos ni DNI: solo identificadores opacos.
- Las cuentas solo valen si el administrador les creó un registro en `lideres/` o `roles/`: una cuenta creada por un tercero no accede a nada, aunque el registro de usuarios estuviera abierto.
- Cada persona solo puede leer su propio registro; nadie puede listar ni probar identificadores ajenos.
- `firebase.js` contiene la configuración web de Firebase: es pública por diseño. Lo que protege los datos son `firestore.rules` y el inicio de sesión.
- **Cualquier página web se puede descargar**: Vercel (Pro) no limita quién la carga salvo con Password Protection (clave compartida, de pago). Lo que se descarga no sirve sin un DNI autorizado.
- Scripts en archivos propios y CSP sin scripts inline. Los módulos de Firebase vienen de `gstatic.com`, fijados a una versión, sin SRI (los módulos ES no lo admiten).
- Los DNI son datos personales (Ley 29733): el Maestro con DNI debe borrarse tras cargarlo y el acceso al proyecto de Firebase, limitarse a quien administra.
- Firebase limita los intentos fallidos por IP y cuenta, pero no hay bloqueo propio. Recomendado: activar **App Check**.
- Archiva la implementación antigua de Apps Script (Implementar → Administrar) y borra su hoja si ya no se usa.

## Límites conocidos
- Sin correos: nadie recibe aviso; el BP debe abrir el panel.
- Los jefes no tienen bandeja propia ni pueden corregir una solicitud «Devuelta al jefe».
- Sin Cloud Functions no hay límite de envíos por persona; si hay abuso, activar App Check.

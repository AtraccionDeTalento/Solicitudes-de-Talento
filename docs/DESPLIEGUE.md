# Puesta en marcha (Firebase + Vercel)

Arquitectura: la página (`index.html`, `panel.html` y sus `.js`) se publica en **Vercel** como sitio estático y habla directamente con **Firestore** y **Firebase Auth**.
No hay servidor propio: la seguridad la dan `firestore.rules` y el inicio de sesión. Plan gratuito de Firebase suficiente. **No envía correos.**

## Cómo se entra
| Quién | Cómo | Qué puede |
|---|---|---|
| Jefe de área | Pantalla de inicio: **nombre y correo `@usil.edu.pe`** (el correo no se verifica) | Crear solicitudes y leer solo las suyas |
| Business Partner | Botón **«Acceso Business Partner y Gerencia»** → panel → **su correo y la clave que ellos mismos eligen** | Ver y gestionar solo lo que llega a él |
| Gerencia (Karla) | El mismo botón → su correo y su clave | Ver lo que los BP le pasan y decidir |

**Cuentas propias (sin que el administrador conozca ninguna clave):** el administrador solo *autoriza correos* (`usuarios.json` sin `clave`). Cada persona entra al panel → **«Crear mi cuenta»**, escribe su correo y elige una clave de 12+ caracteres, abre el enlace que le llega para confirmar el correo y ya puede entrar. **«Olvidé mi clave»** le envía un enlace para elegir otra. Un correo no autorizado puede registrarse pero no ve nada («Tu cuenta no tiene un rol asignado»).

> **Riesgo asumido:** el correo del jefe no se verifica. Quien escriba el de otro jefe puede enviar solicitudes a su nombre (el Business Partner las revisa antes de que lleguen a Gerencia). Por eso, **en producción los jefes no pueden consultar el Maestro** (no hay autocompletado de colaboradores: lo escriben a mano) y solo pueden crear y leer sus propias solicitudes. Sin límite de envíos por persona: si hay abuso, activar App Check.
> Si TI exige identidad verificada, la alternativa gratuita es «Entrar con Google» (cuenta `@usil.edu.pe`); está en el historial de Git (commit `95ddfa8`).

## A. Probar en tu computador (sin nube, sin datos reales)
Necesitas Node 22+ y Java. Una vez: `npm install`. Luego, en **tres terminales** dentro de la carpeta del proyecto:
```bash
npm run emu          # 1) emuladores de Firebase (Auth y Firestore)
npm run seed:local   # 2) datos inventados; imprime las claves de hrbp1@usil.edu.pe y ger1@usil.edu.pe
npm run serve        # 3) la app en http://localhost:5000/
```
- Entra con cualquier nombre y un correo `@usil.edu.pe` inventado; rellena y envía una solicitud (en modo prueba hay botones para rellenarla). Todas llegan a `hrbp1@usil.edu.pe`.
- Pulsa «Acceso Business Partner y Gerencia», entra con `hrbp1` y la clave que imprimió el paso 2, pásala a Gerencia; entra como `ger1@usil.edu.pe` y apruébala.
- Al cerrar los emuladores todo se borra. En `localhost` la app usa siempre los emuladores y no toca la nube (con `?nube` usaría la nube).
- `npm test` (estáticas) y `npm run test:rules` (reglas de seguridad) corren con los emuladores.

## B. Crear el proyecto en Firebase (una vez)
1. https://console.firebase.google.com → **Agregar proyecto** (sin Google Analytics).
2. **Authentication → Método de acceso**: habilita **Anónimo** (sesión del jefe) y **Correo electrónico/contraseña** (HRBP y Gerencia).
   **No desactives «Habilitar la creación (registro)»**: bloquearía también las sesiones anónimas de los jefes. No hace falta: alguien puede registrarse por su cuenta, pero esa cuenta no tiene rol ni correo verificado y las reglas no le dan acceso a nada. Las cuentas de HRBP y Gerencia las crea el script de carga.
   Desde la línea de comandos (sin consola): `npx firebase projects:create`, `apps:create web`, `firestore:databases:create` y `deploy --only firestore:rules,hosting`. Lo único manual es pulsar **«Comenzar»** en Authentication (activarlo por API exige facturación).
3. **Firestore Database → Crear base de datos** (modo producción; región `southamerica-east1`).
4. Pestaña **Reglas**: pega todo `firestore.rules` y **Publicar**.
5. **⚙ Configuración del proyecto → Tus apps → Web (`</>`)**: copia el bloque `firebaseConfig` a `firebase.js` (no es secreto).

## C. Cargar datos y usuarios (una vez)
1. **⚙ → Cuentas de servicio → Generar nueva clave privada**. Guarda el JSON **fuera del repositorio**.
2. Copia `tools/usuarios.ejemplo.txt` como `tools/usuarios.json` (correos sin tildes ni ñ y roles; **sin clave**: cada persona elige la suya) y `tools/ruteo.ejemplo.txt` como `tools/ruteo.local.json` (HRBP de cada departamento). Ambos quedan fuera de GitHub.
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
3. `vercel.json` aplica las cabeceras de seguridad (CSP, HSTS, anti-iframe, nosniff) y `.vercelignore` deja fuera `tools`, `tests`, `docs` y `firestore.rules`.
4. Google Cloud → **Credenciales** → clave de API de Firebase: restringe a la URL de Vercel (referentes HTTP). Firebase → **Authentication → Configuración → Dominios autorizados**: agrégala.
5. Cada `git push` a `main` publica de nuevo.

## Salir de pruebas
- En Firestore, documento `config/app`: `modoPrueba` → `false`. Cierra el Maestro a los jefes y la lista del Maestro a todos.
- En `app.js`: `CONFIG.modoPrueba:false` y `camposObligatorios:true`.
- Pon el ruteo real en `tools/ruteo.local.json`, cambia las claves de prueba de los HRBP y vuelve a ejecutar la carga.

## Seguridad (qué hay y qué no)
- **En el repositorio no hay** correos, nombres, matrículas, claves, planillas ni claves de servicio (`npm test` lo verifica). Lo personal vive en Firestore y en archivos locales ignorados por Git.
- **Ni el código ni la base entregan nombres o correos de los Business Partner a quien no sea personal del panel.** El ruteo guarda solo un identificador aleatorio (`bpId`); el nombre vive en la colección `bps`, que solo leen HRBP y Gerencia; el correo del BP solo existe como su cuenta de acceso. Un jefe (o un visitante con sesión anónima) solo puede leer ese identificador. `npm run test:rules` lo comprueba.
- **Lo que escribe un jefe no puede atacar al personal que lo lee:** todo dato se muestra escapado, y la CSP bloquea scripts inline y manejadores de eventos. Está probado con una solicitud con código en todos los campos: se ve como texto y no se ejecuta nada.
- **La base solo acepta los campos que envía la app**, con tope de tamaño en los textos libres, 80 respuestas de levantamiento y 3 aprobaciones: nadie puede guardar datos ajenos al formulario ni documentos enormes. Las reglas no pueden pasar de 1000 expresiones (Firestore las corta y rechaza todo): `npm run test:rules` incluye una solicitud completa que lo vigila.
- **Nada personal queda en el navegador:** borradores e historial viven en `sessionStorage` (se borran al cerrar la pestaña). El panel guarda la sesión solo mientras la pestaña esté abierta y la cierra tras 30 minutos sin actividad.
- Las claves reales deben tener 12+ caracteres: `cargar-datos.js` se niega a cargar claves más cortas (en los emuladores y en el piloto con datos de prueba sí permite claves cortas, definidas solo en tu `tools/usuarios.json`).
- Cabeceras: `noindex`, sin caché, `Cross-Origin-Resource-Policy: same-origin`, `X-Frame-Options: DENY`, HSTS y CSP. Vercel no publica `.github`, `tools`, `tests`, `docs` ni `firestore.rules`.
- Cada persona del panel solo lee su propio rol; nadie puede listar roles ni líderes.
- Los correos y claves reales viven solo en `tools/usuarios.json` y `tools/ruteo.local.json` (ignorados por Git y excluidos de Vercel).
- `firebase.js` contiene la configuración web de Firebase: es pública por diseño. Lo que protege los datos son `firestore.rules` y los inicios de sesión.
- **Cualquier página web se puede descargar**: Vercel (Pro) no limita quién la carga salvo con Password Protection (clave compartida, de pago). Lo que se descarga no sirve para leer datos sin una clave de HRBP o Gerencia.
- Scripts en archivos propios y CSP sin scripts inline. Los módulos de Firebase vienen de `gstatic.com`, fijados a una versión, sin SRI (los módulos ES no lo admiten).
- Recomendado: activar **App Check** en Firebase.
- Archiva la implementación antigua de Apps Script (Implementar → Administrar) y borra su hoja si ya no se usa.

## Límites conocidos
- Sin correos: nadie recibe aviso; el HRBP debe abrir el panel.
- Los jefes no tienen bandeja propia ni pueden corregir una solicitud «Devuelta al jefe».
- Sin Cloud Functions no hay límite de envíos por persona.

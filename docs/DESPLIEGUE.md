# Puesta en marcha (Firebase + GitHub Pages)

Arquitectura: la página (`index.html` y `panel.html`) vive en GitHub Pages y habla directamente con **Firestore** y **Firebase Auth**.
No hay servidor propio: la seguridad la dan las reglas de `firestore.rules`. Plan gratuito (Spark) suficiente. **No envía correos.**

| Quién | Cómo entra | Qué puede |
|---|---|---|
| Jefe de área | **Entrar con Google** (cuenta `@usil.edu.pe` verificada) | Crear solicitudes a su nombre y leer solo las suyas |
| HRBP | Panel → correo y clave propios | Ver y gestionar solo lo que llega a su correo |
| Gerencia | Panel → correo y clave propios | Ver lo que los HRBP le pasan y decidir |

## 1. Crear el proyecto (una vez, en la consola de Firebase)
1. https://console.firebase.google.com → **Agregar proyecto** (sin Google Analytics).
2. **Compilación → Authentication → Comenzar → Método de acceso**: habilita **Google** (correo de soporte: el tuyo) y **Correo electrónico/contraseña**. **No habilites «Anónimo».**
   Luego, en **Configuración → Acciones del usuario**, **desmarca «Habilitar la creación (registro)»**: las cuentas de HRBP y Gerencia las crea solo el script de carga.
3. **Compilación → Firestore Database → Crear base de datos** (modo producción; región `southamerica-east1`).
4. Pestaña **Reglas**: pega todo `firestore.rules` y **Publicar**.
5. **Configuración del proyecto (⚙) → Tus apps → Web (`</>`)**: registra la app y copia el bloque `firebaseConfig` a `firebase.js` (no es secreto).
6. **Authentication → Configuración → Dominios autorizados**: agrega `atracciondetalento.github.io`.

## 2. Cargar datos y usuarios (una vez)
1. **⚙ → Cuentas de servicio → Generar nueva clave privada**. Guarda el JSON **fuera del repositorio**.
2. Copia `tools/usuarios.ejemplo.txt` como `tools/usuarios.json` (correos sin tildes ni ñ, claves de 12+ caracteres, roles) y `tools/ruteo.ejemplo.txt` como `tools/ruteo.local.json` (HRBP de cada departamento). Ambos quedan fuera de GitHub.
3. Genera el CSV del Maestro: `python tools/preparar-maestro.py "Maestro BPs.xlsx" Maestro_recortado.csv`.
4. En PowerShell:
```powershell
cd tools; npm install
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\ruta\clave-de-servicio.json"
node cargar-datos.js ..\Maestro_recortado.csv
```
Esto crea el ruteo, el modo prueba, los usuarios del panel y el Maestro. Es repetible: vuelve a ejecutarlo para cambiar claves o ruteo.
`--borrar-solicitudes` vacía las solicitudes (útil al terminar las pruebas).

## 3. Publicar
`git push` a `main`: GitHub Pages sirve `index.html` y `panel.html`. Panel: `https://atracciondetalento.github.io/Solicitudes-de-Talento/panel.html`.

## Salir de pruebas
- En Firestore, documento `config/app`: `modoPrueba` → `false` (cierra la lectura en lista del Maestro).
- En `index.html`: `CONFIG.modoPrueba:false` y `camposObligatorios:true`.
- Pon el ruteo real en `tools/ruteo.local.json` y vuelve a cargar.
- Cambia las claves de prueba de los HRBP: vuelve a ejecutar la carga con claves nuevas (se actualizan).

## Seguridad (qué hay y qué no)
- **En el repositorio no hay** correos, nombres, matrículas, claves, planillas ni claves de servicio (`npm test` lo verifica). Lo personal vive en Firestore y en archivos locales ignorados por Git.
- `firebase.js` contiene la configuración web de Firebase: es pública por diseño. Lo que protege los datos son `firestore.rules` y los inicios de sesión.
- Los scripts van en archivos propios y la CSP no permite scripts inline ni orígenes ajenos. GitHub Pages no permite cabeceras HTTP (`frame-ancestors`, HSTS): si TI las exige, hay que servirlo con Firebase Hosting o un proxy.
- Los módulos de Firebase se cargan desde `gstatic.com` fijados a una versión, sin SRI (los módulos ES no lo admiten). Para eliminar esa dependencia externa, copiar el SDK al repositorio.
- Recomendado: activar **App Check** y restringir la clave de API a `atracciondetalento.github.io` (Google Cloud → Credenciales).
- Archiva la implementación antigua de Apps Script (Implementar → Administrar) y borra su hoja si ya no se usa.

## Pruebas
- `npm test`: comprobaciones estáticas.
- `npm run test:rules`: reglas de seguridad contra el emulador (necesita Java).
- Prueba local contra emuladores: abre `http://localhost:PUERTO/index.html?emu`.

## Límites conocidos
- Sin correos: nadie recibe aviso; el HRBP debe abrir el panel. Se puede agregar luego (Apps Script o extensión de Firebase).
- Los jefes no tienen bandeja propia ni pueden corregir una solicitud «Devuelta al jefe» (no hay login individual para ellos).
- Sin Cloud Functions no hay límite de envíos por persona; si hay abuso, activar App Check.
- El correo del jefe es declarado y no verificado (igual que antes).

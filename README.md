# Solicitudes de Talento · USIL

Portal para que los jefes de área registren **solicitudes de movimientos de talento** (promoción, encargatura, reemplazo,
puesto nuevo, incremento salarial, movimiento interno y otros).
Cada solicitud llega **automáticamente al Business Partner** del departamento del colaborador, que la revisa y la pasa a Gerencia.

| Archivo | Contenido |
|---|---|
| `index.html` + `app.js` | App web (sin build): inicio de sesión con correo institucional y clave, 7 pasos guiados, puntaje de preparación y sustento ejecutivo. |
| `panel.html` + `panel.js` | Panel de HRBP y Gerencia: bandeja, detalle, estados, comentarios y descarga de Excel. |
| `firebase.js` + `fb-init.js` | Conexión a Firebase (Firestore y Auth), compartida por ambas páginas. |
| `firestore.rules` | Reglas de seguridad: quién lee y qué cambia cada rol. |
| `tools/` | Carga inicial de datos (ruteo, usuarios, Maestro) y preparación del Maestro. |
| `vercel.json` | Cabeceras de seguridad del sitio en Vercel. |
| `docs/` | Guía de puesta en marcha, lista de preguntas y plantilla de ruteo. |

## Puesta en marcha
Sigue `docs/DESPLIEGUE.md`. Pruebas: `npm test` y `npm run test:rules`.

## Datos
Este repositorio **no debe contener** el Maestro de personal ni claves (DNI, direcciones, datos de salud, claves de servicio).
`.gitignore` ya los excluye. Solo se usan 16 nombres de departamento y los correos institucionales de los BP.

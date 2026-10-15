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

## Seguimiento y presupuesto (reunión con los socios de negocio)
- **Trazabilidad visible para todos:** el HRBP y Gerencia ven la línea de tiempo en el detalle del caso y con el botón **Trazabilidad** de cada fila (se ve en pantalla, no se descarga por caso; el Excel de todos los casos sigue en «⬇ Trazabilidad» de la barra) (con quién actuó); el jefe la ve en «Mis solicitudes → Ver seguimiento» **solo con el rol** (nunca el nombre ni el correo del socio). El comentario llega al jefe únicamente cuando es para él (devolución del socio, decisión de Gerencia).
- **Presupuesto confirmado por el HRBP:** el socio de negocio marca **Sí/No** y, opcionalmente, el **monto** y una nota. El jefe solo ve el Sí/No; el monto vive en `solicitudes/{id}/interno/presupuesto`, que leen el HRBP de la solicitud y Gerencia (cuando ya se la pasaron). Sin Sí/No no se puede escalar a Gerencia.
- **Atómico:** cada gestión (cambio de estado, evento, traza del jefe y presupuesto) se escribe en un solo lote: o queda todo o no queda nada.
- «¿Quién te confirmó el presupuesto?» ya no ofrece **Finanzas**.
- Reglas nuevas en `firestore.rules` (`trazas`, `interno`, `presupuestoConfirmado`): hay que **desplegarlas junto con el código** (`firebase deploy --only firestore:rules,hosting`). Pruebas: `npm run test:rules` (26 + 10).

## Dos accesos para socios de negocio y Gerencia
Quien es socio de negocio o Gerencia **y también pide como jefe de área** (por ejemplo el Subgerente de Talento y Cultura) tiene dos cuentas:
- **Panel (HRBP / Gerencia):** `usuario@usil.edu.pe` con su clave propia, en `panel.html`.
- **Formulario (jefe de área):** `usuario+jefe@usil.edu.pe` con su DNI como clave. En `index.html` se escribe el correo normal y el programa prueba solo con la cuenta `+jefe`; entra como jefe y **no** salta al panel.
`node tools/cargar-datos.js --jefes=tools/jefes-dni.csv` crea las cuentas `+jefe` del personal del panel.

## Quién puede pedir
Piden los **jefes de área** (y jefaturas). Las **socias de negocio no crean solicitudes**: en `tools/usuarios.json` su entrada lleva `"pideComoJefe": false`, que `cargar-datos.js` copia a su rol y las **reglas** hacen cumplir en el servidor (ni con la cuenta del panel ni con el alias `usuario+jefe@`). Además no se les crea cuenta de formulario. Quien no tenga la marca (por ejemplo el Subgerente de Talento, que es jefatura) pide con su acceso `+jefe`.

## Cuestionario y relleno de pruebas
- Las preguntas de opción se responden **Sí / No**: ya no existen «Parcialmente», «Por confirmar», «No se sabe» ni «Por definir». Las preguntas se redactaron para que cuadren con cada movimiento (por ejemplo, el plazo ya no habla de «incorporar» en una promoción, y el reemplazo pregunta por el puesto a cubrir, no por «su nueva posición»).
- **Relleno de pruebas:** 7 clics seguidos en el logo de USIL rellenan todo el formulario con una persona y un movimiento al azar (deja el paso de revisión listo para enviar). Se controla con `CONFIG.demoClics` en `app.js`: **ponerlo en `false` antes de abrirlo a los jefes**. `CONFIG.modoPrueba` (mínimos de caracteres reducidos) sigue apagado.


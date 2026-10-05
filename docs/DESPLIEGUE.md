# Despliegue: Solicitud de Movimiento de Talento (v2.0.0)

Archivo único: `Sistema BP v2.html` (renómbralo a `index.html` al publicarlo). Sin servidor propio, sin build.

## 1. Configurar (bloque `CONFIG`, inicio del `<script>`)

| Campo | Qué poner |
|---|---|
| `endpoint` | URL que recibe el JSON de cada solicitud (flujo HTTP de Power Automate → SharePoint/Lista, o API). **Sin esto las solicitudes solo quedan en el navegador de quien las llena.** |
| `bpEmails` | Correos de los BP/Compensaciones (ven el panel de casos, maestro y exportación). |
| `allowedDomains` | Dominios que pueden ingresar. Por defecto `usil.edu.pe`. |
| `bps` | Lista de BP sugeridos en el campo "Business Partner" (evita "Joshua" vs "Joshua López"). |
| `soporte` | Correo de soporte que se muestra al pie. |
| `sessionMinutes` | Cierre por inactividad (60 por defecto). |

Colores: variables `--navy`, `--royal`, `--green` (azul de acción), `--accent` (amarillo) al inicio del `<style>`. Tomados de usil.edu.pe; valida con el manual de marca de Comunicaciones.

## 2. Publicar (elige una)

1. **Azure Static Web Apps + Microsoft Entra ID** (recomendado): login SSO real con cuentas USIL y control por grupo.
2. **Sitio interno IIS/Nginx detrás del SSO institucional.**
3. **SharePoint** (biblioteca de sitio con permisos restringidos): sirve para piloto; los navegadores pueden descargar el .html en vez de ejecutarlo según la configuración del tenant.

> El inicio de sesión de la página identifica y asigna rol, pero **no es seguridad**: cualquiera con acceso al archivo puede leer su código. La protección real la da el hosting (SSO + permisos). Si el sitio es público, no lo uses con datos reales.

## 3. Antes de abrirlo a los líderes (checklist)

- [ ] `endpoint` configurado y probado con una solicitud real (revisar que llega el JSON y el `id`).
- [ ] Sitio detrás de SSO/Entra y con acceso restringido.
- [ ] `bpEmails` y `bps` completos.
- [ ] Carla validó las columnas del Excel consolidado.
- [ ] TI aprobó la política de datos: la solicitud incluye nombre de colaborador y propuesta salarial.
- [ ] Probado en Edge y Chrome, y en celular.
- [ ] Guía de uso (`Guia_de_Uso_Movimientos_de_Talento.docx`) actualizada: ya no existe "guardar en el navegador" para líderes, y hay paso de inicio de sesión.

## 4. Datos y privacidad

- Líderes: no se carga el maestro (tiene DNI, direcciones y correos personales); completan los datos del colaborador a mano.
- BP: el maestro se carga en su navegador y solo se guardan 8 campos. En equipos compartidos, usar "Cerrar sesión" (borra el borrador) y "Reiniciar sistema".
- Los borradores se guardan por usuario en `localStorage` y se eliminan al enviar o al cerrar sesión manualmente.
- Cada registro lleva `schemaVersion`, `appVersion` y `creadoPor` (nombre, correo y rol de quien envió).

## 5. Limitaciones conocidas

- El Excel consolidado se genera desde los casos guardados en el navegador del BP; con `endpoint` el consolidado debe construirse del lado del flujo/lista.
- SheetJS se carga bajo demanda desde jsDelivr con verificación de integridad (SRI). Para uso sin internet, descárgalo y cámbialo a ruta local.
- No hay pruebas automatizadas; la validación fue manual de extremo a extremo (login, 7 pasos, envío, reabrir caso).

## 6. Asignación automática al Business Partner (v2.1)

- El jefe de área **no elige BP**: el **Departamento** del colaborador (lista de 16, tomada del Maestro 05-10-2026) decide quién recibe la solicitud.
- La tabla vive en la pestaña **Ruteo** del Google Sheet (`Ruteo_BP.xlsx` es la plantilla para llenarla): Departamento · Área (`*` = todas) · BP · correo. La fila más específica (Departamento + Área) gana sobre la general.
- Al enviar (formulario o app web): se guarda la fila en «Entradas» con el BP asignado, se envía un correo al BP con el resumen y otro de confirmación al jefe de área. Sin BP configurado → va al `COORDINADOR` y queda «Sin asignar».
- App web → `Code.gs` desplegado como aplicación web (`doPost`); copia su URL en `CONFIG.endpoint` y el mismo `TOKEN` en `CONFIG.token`.
- El Maestro **no trae** qué BP atiende cada área: esa tabla hay que llenarla (ver `Ruteo_BP.xlsx`). Cuando cambie la estructura, se actualiza solo la pestaña «Ruteo», sin tocar el código.

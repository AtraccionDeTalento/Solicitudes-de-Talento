# Despliegue · Solicitudes de Talento (v2.1)

Dos piezas: **la app web** (`index.html`, GitHub Pages) y **el receptor en Google** (`apps-script/Code.gs`: formulario, hoja de entradas, ruteo al BP y correos).

## 1. Receptor en Google (una sola vez)
1. https://script.google.com › Nuevo proyecto › pegar `apps-script/Code.gs`.
2. `CONFIG`: revisar `COORDINADOR` (César Reyes), `BPS_DIRECTORIO` y `TOKEN` (ya coincide con `index.html`; si lo cambias, cámbialo en ambos).
3. Ejecutar `crearFormulario` (▶), autorizar permisos. Tarda 2–4 min. Ver › Registros: enlace del formulario, de edición y de la hoja.
4. Hoja «Entradas» › pestaña **Ruteo**: elegir el BP de cada departamento (el correo se completa solo).
5. Ejecutar `compartirConBPs` (acceso a los BP y al coordinador) y, si se desea, `crearVistasPorBP`.
6. **Implementar › Nueva implementación › Aplicación web**: ejecutar como *Yo*, acceso *Cualquier usuario*. Copiar la URL `…/exec`.

## 1b. Panel web con tres vistas (jefes · BP · Gerencia)
1. En el mismo proyecto de Apps Script: **+ › HTML** › nombre exacto `Panel` › pegar `apps-script/Panel.html`.
2. En `CONFIG.GERENTES` poner el correo de Karla (gerenta). Quien esté ahí ve la vista **Gerencia** (todo + decisión final Aprobado/Rechazado).
3. Implementar de nuevo (**Administrar implementaciones › editar › Nueva versión**). La URL `…/exec` abierta en el navegador es el panel.
4. **Flujo:** el jefe envía (Nuevo) → el BP revisa y elige *Devuelto al jefe* (le llega correo con enlace para corregir; al reenviar vuelve al BP) o *Enviado a Gerencia* (le llega correo a los `GERENTES`) → Gerencia elige *Aprobado*, *Rechazado* o *En revisión BP* (lo devuelve al BP). Gerencia solo ve lo que el BP le pasó; el BP no puede tocar una solicitud que ya está en Gerencia.
5. Roles (según la cuenta Google con la que entra, no un campo de texto):
   - **Jefe de área**: cualquier `@usil.edu.pe` → *Mis solicitudes* (solo las que envió).
   - **BP**: correos de la pestaña `BPs` → *Bandeja* (solo lo que Ruteo le asigna); cambia estado y comenta, sin aprobar/rechazar.
   - **Gerencia**: correos de `CONFIG.GERENTES` → todo, KPIs por estado/BP/movimiento/departamento, decisión final y comentario.
6. Las solicitudes del **Google Form** y de la **app web** llegan a la misma hoja «Entradas», así que aparecen juntas en el panel.
7. Requisito: quien abre el panel debe estar con su cuenta USIL en el navegador y el dueño del script en el mismo Workspace; si no, Google no entrega el correo y el panel pide iniciar sesión.

## 2. App web (GitHub Pages)
1. En `index.html`, `CONFIG.endpoint` = URL `…/exec` del paso 1.6. Subir el cambio.
2. GitHub › Settings › Pages › *Deploy from a branch* › `main` / `(root)`.
3. Sitio: `https://atracciondetalento.github.io/Solicitudes-de-Talento/`. Para un link institucional, pedir a TI un subdominio (CNAME).

## 3. Protecciones ya incluidas
- La app web solo acepta correos `@usil.edu.pe`; el servidor lo valida de nuevo.
- Token compartido, límite de 10 envíos por correo y hora, 300 por día, solicitudes de máx. 60 KB.
- Validación de departamento, tipo de movimiento, fecha, matrícula y opciones; limpieza de caracteres de control; los correos escapan el HTML.
- Nadie puede pisar la solicitud de otro (mismo ID con otro correo se rechaza).
- Los correos del BP indican si el correo del solicitante está **verificado** (formulario) o es **declarado** (app web).
- CSP, `noindex`, librería de Excel con verificación de integridad, hoja de cálculo en texto (sin fórmulas inyectables).

## 4. Límites conocidos
- **El inicio de sesión de la app web identifica, no autentica**: el correo lo escribe el usuario. Para identidad verificada usar el formulario de Google (correo verificado) o alojar la app tras el SSO institucional.
- Una página en GitHub Pages es pública; el token no es secreto, solo frena envíos casuales.
- Cuota de correo de Apps Script: ~100/día (cuenta personal) o ~1500/día (Workspace).
- Los BP con acceso a la hoja ven todas las entradas; para separar por BP usar archivos distintos.
- El puntaje y el sustento del formulario de Google se calculan después, con `exportarEntradas`.

## 5. Antes de abrirlo a todos
- [ ] Ruteo completo (16 departamentos con BP).
- [ ] Prueba de punta a punta con 2–3 jefes de área y datos ficticios (llegada al BP correcto, correos, edición).
- [ ] TI aprueba el tratamiento de datos (nombres de colaboradores y propuestas salariales).
- [ ] Carla valida las columnas del consolidado.
- [ ] Guía de usuario actualizada.

## 6. Pruebas
`npm test` (Node 20): 22 pruebas del Apps Script con servicios de Google simulados y 7 comprobaciones de la app web. CI en GitHub Actions.

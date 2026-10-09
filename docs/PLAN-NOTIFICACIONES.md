# Plan: notificaciones por Teams y correo con Power Automate

## Qué debe avisar
| Evento | Quién lo origina | A quién avisa | Contenido |
|---|---|---|---|
| Solicitud nueva | Jefe de área | Business Partner asignado | caso, colaborador, movimiento, enlace al panel |
| Devuelta con observaciones | Business Partner | **Jefe que la envió** | observación del BP + enlace para corregir |
| Corregida y reenviada | Jefe | Business Partner | aviso de reenvío |
| Derivada a otro BP | Business Partner | BP destino | quién la deriva y el motivo |
| Escalada a Gerencia | Business Partner | Gerencia (Karla) | resumen del caso |
| Aprobada / Rechazada con observaciones | Gerencia | **Jefe** y BP | decisión + comentario de Gerencia |
| Copia de control (fase de prueba) | todos | tu correo | el mismo aviso, para que lo revises antes de abrirlo al resto |

Mientras dure la prueba, **todos los avisos llegan solo a tu correo** (variable `DESTINO_PRUEBA`); al pasar a producción se cambia a los destinatarios reales sin tocar el flujo.

## Arquitectura (sin claves en el código ni datos sensibles expuestos)
1. Cada cambio de estado en Firestore escribe un documento en `avisos/{id}` con **solo** `{tipo, solicitudId, para, asunto, creado}` (el cuerpo con datos del caso NO se guarda ahí; el flujo lo arma con el enlace al panel).
   - Lo escribe el propio panel al guardar (reglas: solo personal verificado puede crear `avisos`; nadie puede leerlos desde el navegador).
2. Un flujo de **Power Automate** (cola) lee los avisos nuevos y envía el correo + mensaje de Teams.
   - Disparador: «Cuando se recibe una solicitud HTTP» (URL firmada del flujo), llamada por una **Cloud Function** `notificar` de Firebase que se dispara con `onDocumentCreated('avisos/{id}')`. La URL del flujo vive en Secret Manager, nunca en el repositorio ni en el navegador.
   - Alternativa sin Cloud Functions (si no hay plan Blaze): el flujo consulta la API REST de Firestore cada 5 min con una cuenta de servicio de solo lectura sobre `avisos`.
3. El flujo marca el aviso como enviado (`enviado:true`) para no repetir.

## Flujo de Power Automate (a construir)
- Nombre: `Solicitudes y movimientos - Avisos`
- Disparador: HTTP request con esquema `{tipo, para, asunto, solicitudId, enlace}`.
- Condición: `DESTINO_PRUEBA` activo → reemplaza `para` por tu correo y antepone «[PRUEBA] al asunto».
- Acciones: Enviar correo (Office 365 Outlook) con plantilla HTML por `tipo`; Publicar en Teams (opcional) al canal de Atracción de Talento.
- Plantillas: nueva, devuelta, reenviada, derivada, escalada, aprobada, rechazada.

## Reglas de devolución
- **BP devuelve al jefe** → estado «Devuelto al jefe»; el jefe recibe correo con la observación; entra, corrige y reenvía → vuelve a «Nuevo» al mismo BP.
- **Gerencia rechaza** → estado «Rechazado»; el jefe recibe la observación del comité y puede corregir y reenviar como caso nuevo vinculado.
- Esto requiere que el jefe pueda ver y reenviar sus solicitudes devueltas (hoy solo crea): se añade la vista «Mis solicitudes» y la regla de actualización acotada por `uid`.

## Seguridad
- Sin contraseñas ni URL del flujo en el repositorio ni en el sitio; el correo del jefe ya consta en la solicitud.
- Solo `avisos` con campos mínimos; los avisos no se pueden leer desde el navegador.
- El flujo corre con la cuenta de servicio de USIL (cuando migre) y se prueba antes solo hacia tu correo.

## Pasos
1. Datos de prueba: 60 casos con estados variados en la vista de Karla. ✔ (en curso)
2. Crear en Power Automate el flujo «Solicitudes y movimientos - Avisos» con las plantillas (lo hará el agente con Claude in Chrome, en tu sesión de Microsoft 365).
3. Añadir `avisos` + reglas + vista «Mis solicitudes» + reenvío del jefe.
4. Cloud Function `notificar` (requiere plan Blaze) **o** consulta periódica.
5. Prueba de punta a punta: todo llega a tu correo; luego se activa por rol.

## Qué necesito de ti
- Confirmar que el agente puede crear el flujo en tu cuenta de Power Automate (tu sesión ya iniciada en Chrome).
- Tu correo de destino de pruebas.
- Si prefieres Cloud Function (Blaze) o consulta periódica.

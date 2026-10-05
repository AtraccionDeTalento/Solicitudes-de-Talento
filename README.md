# Solicitudes de Talento · USIL

Portal para que los jefes de área registren **solicitudes de movimientos de talento** (promoción, encargatura, reemplazo,
puesto nuevo, incremento salarial, movimiento lateral, horizontal, reestructuración de área, revalorización, convenio y otros).
Cada solicitud llega **automáticamente al Business Partner** del departamento del colaborador.

| Carpeta | Contenido |
|---|---|
| `index.html` | App web (una sola página, sin build): inicio de sesión, 7 pasos guiados, puntaje de preparación y sustento ejecutivo. |
| `apps-script/Code.gs` | Google Apps Script: crea el Google Form completo, la hoja «Entradas», el ruteo Departamento → BP, los correos y el receptor de la app web. |
| `docs/` | Guía de despliegue, lista de preguntas y plantilla de ruteo. |

## Puesta en marcha
1. Edita `CONFIG` en `index.html` (`endpoint`, `token`, `bpEmails`) y en `apps-script/Code.gs` (`COORDINADOR`, `TOKEN`, `BPS_DIRECTORIO`).
2. Sigue `docs/DESPLIEGUE.md`.

## Datos
Este repositorio **no debe contener** el Maestro de personal ni exportaciones de entradas (DNI, direcciones, datos de salud).
`.gitignore` ya los excluye. Solo se usan 16 nombres de departamento y los correos institucionales de los BP.

## Privacidad y seguridad
El inicio de sesión de la página identifica y asigna rol, pero no es seguridad: el acceso real lo debe dar el hosting (SSO institucional).

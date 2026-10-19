# Inventario de preguntas del formulario

Generado del código actual (rama piloto). Columna **Dónde**: archivo y línea para borrarla. **Se ve**: si hoy aparece en pantalla.

## Paso 2 · Preguntas por movimiento (app.js, objeto SETS)

### Promoción

| # | Pregunta | Respuesta | Condición | Dónde |
|---|---|---|---|---|
| 1 | ¿A qué puesto se propone promover al colaborador? | text |  | app.js:34 |
| 2 | ¿Desde cuándo asumiría o viene realizando las funciones del nuevo puesto? | date |  | app.js:35 |
| 3 | ¿La posición existe y está aprobada dentro de la estructura? | Sí · No |  | app.js:36 |
| 4 | ¿Qué cambia respecto a su puesto actual? | textarea |  | app.js:37 |
| 5 | ¿Por qué se propone a este colaborador para asumir la nueva posición? | textarea |  | app.js:38 |
| 6 | ¿Qué se busca lograr con la promoción y qué ocurriría si no se formaliza? | textarea |  | app.js:39 |

### Encargatura

| # | Pregunta | Respuesta | Condición | Dónde |
|---|---|---|---|---|
| 1 | Tipo de encargatura | Nueva encargatura · Renovación · Cambio de encargatura |  | app.js:41 |
| 2 | ¿Qué situación genera la necesidad de la encargatura? | Vacaciones · Licencia · Vacante · Cese · Proyecto temporal · Otro |  | app.js:42 |
| 3 | ¿Qué posición requiere cobertura y a quién reemplaza? | text |  | app.js:43 |
| 4 | **¿Desde cuándo y hasta cuándo se requiere la encargatura?** — Fecha de inicio | date |  | app.js:44 |
|  | Fecha estimada de fin | date |  | app.js:44 |
| 5 | **¿Qué cambiará temporalmente en las responsabilidades del colaborador?** — ¿Mantendrá sus funciones actuales? | Sí · No · Parcialmente |  | app.js:46 |
|  | ¿Tendrá equipo adicional a cargo? ¿Cuántas personas? | Ninguna · 1 · 2 · 3 · 4 · 5 · 6 a 10 · 11 a 20 · Más de 20 |  | app.js:47 |
|  | ¿Qué responsabilidades adicionales asumirá? | textarea |  | app.js:48 |
| 6 | **¿Qué se busca asegurar con esta encargatura y qué ocurriría si no se formaliza?** — Objetivo | Continuidad operativa · Continuidad del liderazgo · Cobertura de una posición crítica · Cumplimiento de metas · Continuidad de proyecto o proceso · Otro |  | app.js:50 |
|  | ¿Qué impacto tendría no formalizarla? | textarea |  | app.js:51 |
| 7 | Fecha del primer convenio | date | si tipoEncargatura = Renovación | app.js:52 |
| 8 | ¿Hasta qué fecha está vigente actualmente? | date | si tipoEncargatura = Renovación | app.js:53 |
| 9 | ¿Por cuánto tiempo adicional se solicita renovar? | text | si tipoEncargatura = Renovación | app.js:54 |
| 10 | ¿Se mantienen las mismas funciones y condiciones? | Sí · No | si tipoEncargatura = Renovación | app.js:55 |
| 11 | ¿Cambia el monto de la asignación? | Sí · No | si tipoEncargatura = Renovación | app.js:56 |
| 12 | ¿Qué resultados justifican continuar con la encargatura? | textarea | si tipoEncargatura = Renovación | app.js:57 |
| 13 | ¿Qué posición tenía encargada anteriormente? | text | si tipoEncargatura = Cambio de encargatura | app.js:58 |
| 14 | ¿A qué nueva posición cambia la encargatura? | text | si tipoEncargatura = Cambio de encargatura | app.js:59 |
| 15 | ¿Por qué se requiere cambiar la encargatura? | textarea | si tipoEncargatura = Cambio de encargatura | app.js:60 |
| 16 | ¿Cambia la asignación económica? | Sí · No | si tipoEncargatura = Cambio de encargatura | app.js:61 |

### Reemplazo

| # | Pregunta | Respuesta | Condición | Dónde |
|---|---|---|---|---|
| 1 | ¿A quién reemplaza el colaborador? | text |  | app.js:63 |
| 2 | ¿Cuál es el motivo del reemplazo? | Renuncia · Cese · Promoción · Movimiento interno · Otro |  | app.js:64 |
| 3 | ¿Desde cuándo se requiere cubrir la posición? | date |  | app.js:65 |
| 4 | ¿La posición ya está aprobada dentro de la estructura vigente? | Sí · No · Por confirmar |  | app.js:66 |
| ↳ | Indica si corresponde a una posición adicional o a una modificación de estructura | Posición adicional · Modificación de estructura | si posicionAprobadaRep = No | app.js:67 |
| 5 | ¿Se mantiene el presupuesto de la posición reemplazada? | Sí · No · Por confirmar |  | app.js:68 |
| ↳ | Si cambia, indica brevemente qué cambia | textarea | si presupuestoSeMantiene = No | app.js:69 |
| 6 | ¿Existe algún cambio respecto a la posición que se está reemplazando? | No, se mantiene igual · Sí, cambia puesto, responsabilidades, nivel o condiciones |  | app.js:70 |
| ↳ | Explica brevemente | textarea | si cambioPosicionRep = Sí, cambia puesto, responsabilidades, nivel o condiciones | app.js:71 |

### Puesto nuevo

| # | Pregunta | Respuesta | Condición | Dónde |
|---|---|---|---|---|
| 1 | ¿Qué puesto se solicita crear? | text |  | app.js:73 |
| 2 | ¿Qué necesidad del negocio origina la creación del puesto? | textarea |  | app.js:74 |
| 3 | ¿Por qué la estructura actual no puede cubrir esta necesidad? | textarea |  | app.js:75 |
| 4 | **¿Cuántas posiciones se requieren y desde cuándo?** — Cantidad | 1 · 2 · 3 · 4 · 5 · 6 · 7 · 8 · 9 · 10 · Más de 10 |  | app.js:76 |
|  | Fecha tentativa | date |  | app.js:76 |
| 5 | **¿Cómo será la posición?** — Permanente / Temporal | Permanente · Temporal |  | app.js:77 |
|  | Reporta a | text |  | app.js:77 |
|  | Tendrá personas a cargo | Sí · No |  | app.js:77 |
| ↳ | Cantidad de personas | 1 · 2 · 3 · 4 · 5 · 6 a 10 · 11 a 20 · Más de 20 | si tienePersonasPN = Sí | app.js:78 |
| 6 | ¿Qué responsabilidades y resultados principales tendrá el puesto? | textarea |  | app.js:79 |
| 7 | ¿Qué impacto tendría no crear esta posición? | textarea |  | app.js:80 |

### Incremento salarial

| # | Pregunta | Respuesta | Condición | Dónde |
|---|---|---|---|---|
| 1 | ¿Cuál es el motivo principal del incremento? | Retención · Ampliación de responsabilidades · Mérito · Regularización · Obtención de Grado Académico · Otro |  | app.js:82 |
| 2 | ¿Detallar el motivo seleccionado? | textarea |  | app.js:83 |
| 3 | ¿Qué ocurriría si el incremento no se realiza? | textarea |  | app.js:84 |
| 4 | ¿Existe riesgo de salida? | Sí · No | si motivoIncremento = Retención | app.js:85 |
| 5 | ¿El colaborador comunicó intención de renuncia? | Sí · No | si motivoIncremento = Retención | app.js:86 |
| 6 | ¿Existe una oferta externa? | Sí · No | si motivoIncremento = Retención | app.js:87 |
| ↳ | Adjuntar evidencia | Correo · Carta oferta · Mensaje · Otro | si ofertaExterna = Sí | app.js:88 |

### Movimiento interno (preguntas antiguas: Amador no envió las suyas)

| # | Pregunta | Respuesta | Condición | Dónde |
|---|---|---|---|---|
| 1 | **Necesidad** — ¿Qué necesidad origina el movimiento interno? | textarea |  | app.js:91 |
|  | ¿Qué problema organizacional busca resolver? | textarea |  | app.js:92 |
| 2 | **Destino** — Puesto destino | text |  | app.js:94 |
|  | Área destino | text |  | app.js:95 |
|  | ¿Existe cambio de ubicación? | Sí · No |  | app.js:96 |
|  | ¿Existe cambio de jornada? | Sí · No |  | app.js:97 |
| 3 | **Cambios en el rol** — ¿Cambia el nivel de responsabilidad? | Sí · No |  | app.js:99 |
|  | ¿Cómo cambia el alcance? | textarea |  | app.js:100 |
|  | ¿Qué funciones nuevas asumirá? | textarea |  | app.js:101 |
| 4 | **Resultado esperado e impacto** — ¿Qué se espera lograr con el movimiento? | textarea |  | app.js:103 |
|  | ¿Se solicita un incremento salarial con este movimiento? | Sí · No |  | app.js:104 |

### Otro

| # | Pregunta | Respuesta | Condición | Dónde |
|---|---|---|---|---|
| 1 | ¿Qué movimiento o cambio se solicita? | textarea |  | app.js:106 |
| 2 | ¿Por qué se solicita este movimiento? | textarea |  | app.js:107 |
| 3 | ¿Qué ocurriría si no se realiza? | textarea |  | app.js:108 |

## Preguntas comunes (app.js)

| Paso | Pregunta | Se ve | Dónde |
|---|---|---|---|
| Paso 1 | Tipo de movimiento (tarjetas) | Sí | app.js:607 |
| Paso 1 | Fecha de solicitud | No (automática) | app.js:607 |
| Paso 1 | Nombre del líder | No (del inicio de sesión) | app.js:614 |
| Paso 1 | Cargo del líder | No (del inicio de sesión) | app.js:614 |
| Paso 1 | Correo del líder | No (del inicio de sesión) | app.js:614 |
| Paso 1 | Nombre y apellido del colaborador | Solo en «Corregir datos» | app.js:315 |
| Paso 1 | Puesto | Solo en «Corregir datos» | app.js:615 |
| Paso 1 | Departamento | Puesto nuevo / «Corregir datos» | app.js:516 |
| Paso 1 | Área | Puesto nuevo / «Corregir datos» | app.js:615 |
| Paso 1 | Sección | Puesto nuevo / «Corregir datos» | app.js:615 |
| Paso 2 | ¿La solicitud cuenta con aprobación de la gerencia? | Sí | app.js:1068 |
| Paso 2 | ¿Presupuesto confirmado por tu Socio de negocio? | Sí (no en Reemplazo) | app.js:617 |
| Paso 2 | ¿Quién te confirmó que hay presupuesto? | No (se llena solo) | app.js:617 |
| Paso 2 | ¿Para cuándo se necesita implementar este movimiento? | No (oculta) | app.js:618 |
| Paso 2 | Nivel de impacto si no se ejecuta | No (oculta) | app.js:618 |
| Paso 2 | Principal consecuencia de no aprobar | No (oculta) | app.js:618 |
| Paso 2 | Explique brevemente el impacto | No (oculta) | app.js:1068 |
| Paso 3 | Sustento ejecutivo (se arma solo) | Plegado en Revisión | app.js:1068 |
| Paso 1 | Buscar por correo institucional (colaborador) | Sí | app.js:616 |
| Paso 2 | Aprobación: ¿Quién aprobó? · Fecha de aprobación · Evidencia de aprobación · Adjuntar evidencia | Si hay aprobación | app.js:737 |
| Paso 3 | Confirmo que la información es veraz… | Sí | index.html:288 |

## Descriptivo de puesto (dpform.js)

Nombre del puesto · Reporta a · Misión · Funciones · Supervisa a · Grado académico · Profesiones afines · Experiencia mínima · Idiomas · Ofimática · Competencias · Partir de un descriptivo existente — dpform.js:43

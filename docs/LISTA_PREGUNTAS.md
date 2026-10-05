# Lista de preguntas, campos y tipos de respuesta

Generada desde `Sistema BP v2.html`. **Campo** es el identificador interno (columna al exportar). Los límites de caracteres son [mínimo–máximo].

## 1. Datos comunes a todos los movimientos

### 1.1 Solicitud y líder

> El **Business Partner ya no se pregunta**: se asigna solo según el Departamento (tabla «Ruteo»).

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `fechaSolicitud` | Fecha de solicitud | Fecha | Libre | — | Sí |
| `movimiento` | Tipo de movimiento | Lista desplegable | Promoción · Encargatura · Reemplazo · Puesto nuevo · Incremento salarial · Movimiento lateral · Movimiento horizontal · Reestructuración de área · Revalorización de puesto · Convenio / caso especial · Otro | — | Sí |
| `cliente` | Nombre del líder solicitante | Texto corto | Libre | 2–100 car. (se autocompleta con el login) | Sí |
| `cargoCliente` | Cargo del líder | Texto corto | Libre | 2–100 car. | Sí |
| `emailCliente` | Correo del líder | Correo | Libre | Formato de correo (se autocompleta con el login) | Sí |

### 1.2 Colaborador (todos los movimientos salvo Puesto nuevo y Reestructuración)

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `codigo` | Código del colaborador (matrícula) | Texto corto | Libre | 4–10 dígitos; se completa a 10 con ceros | Sí |
| `colaborador` | Nombre y apellido | Texto corto | Libre | 2–100 car. | Sí |
| `puestoActual` | Puesto | Texto corto | Libre | 2–100 car. | Sí |
| `departamento` | Departamento | Lista desplegable | DIRECCION GENERAL DE SEDES DESCENTRALIZADAS · DIRECCION GENERAL DEL CSIR · ESCUELA DE POSGRADO · GERENCIA DE ADMINISTRACION Y SEGURIDAD · GERENCIA DE PROYECTOS - SEDE PERU · GERENCIA DE TALENTO Y CULTURA · GERENCIA GENERAL · GERENCIA LEGAL · GERENCIA SENIOR DE FINANZAS · PRESIDENCIA EJECUTIVA · RECTORADO · VICEPRESIDENCIA DE ASUNTOS CORPORATIVOS · VICEPRESIDENCIA DE COMUNICACIONES E INNOVACION DIG · VICEPRESIDENCIA SENIOR · VICERRECTORADO ACADEMICO · VICERRECTORADO DE INVESTIGACION | — | Sí |
| `area` | Área | Texto corto | Libre | 2–100 car. | Sí |
| `seccion` | Sección | Texto corto | Libre | 2–100 car. | Sí |

> En **Puesto nuevo** y **Reestructuración de área** no hay matrícula: el código queda «No aplica», el nombre «Vacante nueva» / «Varios colaboradores», y Departamento, Área y Sección se escriben a mano.

## 2. Preguntas por tipo de movimiento

### 2.1 Promoción (12 preguntas)

**Cambio propuesto**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `puestoPropuesto` | ¿A qué puesto se propone promover? | Texto corto | Libre | 2–100 car. | Sí |
| `desdeCuando` | ¿Desde cuándo realiza o realizará estas funciones? | Fecha | Libre | — | Sí |
| `posicionExiste` | ¿Existe la posición en la estructura? | Lista desplegable | Sí · No · Por confirmar | — | Sí |
| `mayorDecision` | ¿Tendrá mayor nivel de decisión? | Lista desplegable | Sí · No · Parcialmente | — | Sí |
| `personasCargo` | ¿Tendrá personas a cargo? ¿Cuántas? | Texto corto | Libre | 1–60 car. | Sí |

**Qué cambió en el rol**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `queCambioPromo` | ¿Qué cambió en el rol para que hoy se plantee una promoción? | Párrafo | Libre | 60–600 car. | Sí |
| `nuevasResponsabilidades` | ¿Qué mayor responsabilidad asumirá o ya viene asumiendo? | Párrafo | Libre | 40–500 car. | Sí |
| `mayorAlcance` | ¿Cómo aumentó el alcance del puesto? | Párrafo | Libre | 40–500 car. | Sí |
| `funcionesNuevas` | ¿Qué actividades nuevas realizará? | Párrafo | Libre | 40–500 car. | Sí |

**Sustento de la promoción**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `porQuePromocion` | ¿Por qué este cambio corresponde a una promoción y no solo a un incremento salarial? | Párrafo | Libre | 60–600 car. | Sí |

**Resultado esperado e impacto**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `resultadoEsperadoPromo` | ¿Qué se logrará al formalizar la promoción? | Párrafo | Libre | 40–500 car. | Sí |
| `impactoNoPromocion` | ¿Qué ocurriría si la promoción no se formaliza? | Párrafo | Libre | 40–500 car. | Sí |

### 2.2 Encargatura (21 preguntas)

**Tipo y motivo**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `tipoEncargatura` | Tipo de encargatura | Lista desplegable | Nueva encargatura · Renovación de encargatura · Cambio de encargatura | — | Sí |
| `motivoEncargo` | ¿Qué situación genera la necesidad de la encargatura? | Lista desplegable | Vacaciones · Licencia · Vacante · Cese · Proyecto · Otro | — | Sí |
| `puestoEncargado` | ¿Qué posición requiere cobertura? | Texto corto | Libre | 2–100 car. | Sí |
| `aQuienReemplaza` | ¿A quién reemplaza o qué vacancia cubre? | Texto corto | Libre | 3–120 car. | Sí |

**Vigencia**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `fechaInicioEnc` | Fecha de inicio | Fecha | Libre | — | Sí |
| `fechaFinEnc` | Fecha estimada de fin | Fecha | Libre | — | Sí |
| `yaEmpezo` | ¿La encargatura ya empezó? | Lista desplegable | Sí · No | — | Sí |

**Condiciones de la renovación** — solo si «tipoEncargatura» = «Renovación de encargatura» (opcionales)

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `fechaPrimerConvenio` | Fecha del primer convenio | Fecha | Libre | — | No |
| `fechaTerminoActual` | Fecha de término actual | Fecha | Libre | — | No |
| `periodoRenovacion` | ¿Por cuánto tiempo se desea renovar? | Texto corto | Libre | 2–40 car. | No |
| `mismasFuncionesRen` | ¿Se mantienen las mismas funciones? | Lista desplegable | Sí · No · Parcialmente | — | No |
| `cambiaMontoRen` | ¿Cambió el monto de la asignación? | Lista desplegable | Sí · No · Por confirmar | — | No |
| `resultadosRen` | ¿Qué resultados o evidencias muestran que la encargatura ha funcionado durante el periodo anterior? | Párrafo | Libre | 30–300 car. | No |

**Condiciones del cambio** — solo si «tipoEncargatura» = «Cambio de encargatura» (opcionales)

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `puestoEncargaturaAnterior` | Posición encargada anterior | Texto corto | Libre | 2–100 car. | No |
| `cambiaAsignacionEnc` | ¿Cambia la asignación económica? | Lista desplegable | Sí · No · Por confirmar | — | No |
| `motivoCambioEnc` | ¿Por qué cambia la encargatura a una nueva posición? | Párrafo | Libre | 30–300 car. | No |

**Funciones durante la encargatura**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `mantieneFunciones` | ¿Mantendrá sus funciones actuales? | Lista desplegable | Sí · No · Parcialmente | — | Sí |
| `equipoAdicional` | ¿Tendrá equipo adicional a cargo? | Texto corto | Libre | 1–60 car. | Sí |
| `responsabilidadesExtra` | ¿Qué responsabilidades adicionales asumirá? | Párrafo | Libre | 40–500 car. | Sí |

**Resultado esperado e impacto**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `resultadoEsperadoEnc` | ¿Qué se busca asegurar con esta encargatura? | Párrafo | Libre | 40–500 car. | Sí |
| `riesgoNoFormalizar` | ¿Qué ocurriría si no se formaliza? | Párrafo | Libre | 40–500 car. | Sí |

### 2.3 Reemplazo (12 preguntas)

**Posición a reemplazar**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `puestoReemplazo` | ¿Qué posición requiere ser reemplazada? | Texto corto | Libre | 2–100 car. | Sí |
| `personaOVacanteReemplazo` | ¿A quién reemplaza o qué vacante ocupa? | Texto corto | Libre | 3–120 car. | Sí |
| `motivoVacanteReemplazo` | ¿Cuál es el motivo por el que la posición queda vacante? | Lista desplegable | Renuncia · Cese · Promoción · Traslado · Cambio interno · Otro | — | Sí |
| `fechaVacanteReemplazo` | ¿Desde qué fecha se encuentra o se encontrará vacante la posición? | Fecha | Libre | — | Sí |

**Colaborador propuesto**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `fechaInicioReemplazo` | ¿Desde qué fecha se propone que el colaborador asuma la posición? | Fecha | Libre | — | Sí |
| `situacionPuestoActualReemplazo` | ¿Qué ocurrirá con la posición actual del colaborador propuesto? | Lista desplegable | Quedará vacante · Será cubierta · Se elimina · Por definir · No aplica | — | Sí |
| `personasCargoReemplazo` | ¿Tendrá personas a cargo? ¿Cuántas? | Texto corto | Libre | 1–60 car. | Sí |
| `porQueColaboradorReemplazo` | ¿Por qué se propone a este colaborador para ocupar la posición? | Párrafo | Libre | 60–600 car. | Sí |

**Cambios en el rol**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `responsabilidadesReemplazo` | ¿Qué responsabilidades asumirá en la nueva posición? | Párrafo | Libre | 40–500 car. | Sí |
| `cambioAlcanceReemplazo` | ¿Cómo cambia su alcance, nivel de responsabilidad o toma de decisiones? | Párrafo | Libre | 40–500 car. | Sí |

**Resultado esperado e impacto**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `resultadoEsperadoReemplazo` | ¿Qué se busca asegurar o mejorar con este reemplazo? | Párrafo | Libre | 40–500 car. | Sí |
| `impactoNoReemplazo` | ¿Qué ocurriría si la posición no se cubre o el reemplazo no se formaliza? | Párrafo | Libre | 40–500 car. | Sí |

### 2.4 Puesto nuevo (13 preguntas)

**El puesto solicitado**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `puestoNuevo` | Nombre del puesto solicitado | Texto corto | Libre | 2–100 car. | Sí |
| `temporalPermanente` | ¿Es permanente o temporal? | Lista desplegable | Permanente · Temporal · Por definir | — | Sí |
| `reportaA` | ¿A quién reportará? | Texto corto | Libre | 2–100 car. | Sí |
| `personasCargoPN` | ¿Tendrá personal a cargo? ¿Cuánto? | Texto corto | Libre | 1–60 car. | Sí |
| `fechaRequerida` | Fecha requerida | Fecha | Libre | — | Sí |

**Necesidad del negocio**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `necesidadPuesto` | ¿Qué necesidad del negocio origina la creación del puesto? | Párrafo | Libre | 60–600 car. | Sí |
| `problemaResuelve` | ¿Qué problema existe actualmente por no contar con esta posición? | Párrafo | Libre | 60–600 car. | Sí |
| `porQueNoAbsorbe` | ¿Por qué la estructura actual no puede absorber esta necesidad? | Párrafo | Libre | 60–600 car. | Sí |
| `similarOtraUnidad` | ¿Existe una posición similar en otra unidad? | Lista desplegable | Sí · No · Por confirmar | — | Sí |

**Alcance del puesto**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `responsabilidadesPuesto` | ¿Qué responsabilidades tendrá el puesto? | Párrafo | Libre | 60–600 car. | Sí |
| `entregables` | ¿Qué resultados concretos deberá entregar? | Párrafo | Libre | 40–500 car. | Sí |

**Resultado esperado e impacto**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `mejoraEsperadaPN` | ¿Qué cambiará o mejorará concretamente con la creación de este puesto? | Párrafo | Libre | 40–500 car. | Sí |
| `impactoNoCrear` | ¿Qué ocurriría si el puesto no se crea? | Párrafo | Libre | 40–500 car. | Sí |

### 2.5 Incremento salarial (12 preguntas)

**Motivo y situación**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `motivoIncremento` | Motivo principal del incremento | Lista desplegable | Retención · Equidad interna · Ampliación de responsabilidades · Mérito · Regularización · Contraoferta · Obtención de Grado Académico · Otro | — | Sí |
| `desdeCuandoInc` | ¿Desde cuándo se presenta esta situación? | Fecha | Libre | — | Sí |
| `situacionOrigen` | ¿Qué situación origina la solicitud? | Párrafo | Libre | 60–600 car. | Sí |
| `queCambio` | ¿Qué cambió en el puesto, desempeño o contexto que sustenta la revisión? | Párrafo | Libre | 60–600 car. | Sí |

**Evidencia y riesgo de salida**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `riesgoSalida` | ¿Existe riesgo de salida? | Lista desplegable | Sí · No · No se sabe | — | Sí |
| `ofertaExterna` | ¿Existe oferta externa? | Lista desplegable | Sí · No · No se sabe | — | Sí |
| `intencionRenuncia` | ¿Comunicó intención de renuncia? | Lista desplegable | Sí · No · No se sabe | — | Sí |
| `evidenciaRiesgo` | ¿Qué evidencia concreta respalda la solicitud? | Párrafo | Libre | 60–600 car. | Sí |
| `impactoSalida` | ¿Qué impacto tendría una eventual salida o no atender la revisión? | Párrafo | Libre | 40–500 car. | Sí |

**Resultado esperado**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `resultadoEsperadoInc` | ¿Qué se busca lograr con la revisión salarial? | Párrafo | Libre | 40–500 car. | Sí |

**Propuesta del negocio**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `tipoPropuestaNegocio` | Tipo de propuesta del negocio | Lista desplegable | Monto en S/ · Porcentaje % | — | Sí |
| `propuestaNegocio` | Valor de la propuesta | Número | Libre | > 0 | Sí |

### 2.6 Movimiento lateral (11 preguntas)

**Necesidad**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `motivoMovimiento` | ¿Qué necesidad origina el movimiento lateral? | Párrafo | Libre | 60–600 car. | Sí |
| `problemaResuelveML` | ¿Qué problema organizacional busca resolver? | Párrafo | Libre | 40–500 car. | Sí |

**Destino**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `puestoDestino` | Puesto destino | Texto corto | Libre | 2–100 car. | Sí |
| `areaDestino` | Área destino | Texto corto | Libre | 2–100 car. | Sí |
| `cambioUbicacion` | ¿Existe cambio de ubicación? | Lista desplegable | Sí · No | — | Sí |
| `cambioJornada` | ¿Existe cambio de jornada? | Lista desplegable | Sí · No | — | Sí |

**Cambios en el rol**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `cambiaResponsabilidad` | ¿Cambia el nivel de responsabilidad? | Lista desplegable | Sí · No · Parcialmente | — | Sí |
| `cambiaAlcance` | ¿Cómo cambia el alcance? | Párrafo | Libre | 40–500 car. | Sí |
| `nuevasFuncionesML` | ¿Qué funciones nuevas asumirá? | Párrafo | Libre | 40–500 car. | Sí |

**Resultado esperado e impacto**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `resultadoEsperadoML` | ¿Qué se espera lograr con el movimiento? | Párrafo | Libre | 40–500 car. | Sí |
| `solicitaIncrementoML` | ¿El cliente solicita incremento salarial? | Lista desplegable | Sí · No · Por confirmar | — | Sí |

### 2.7 Movimiento horizontal (12 preguntas)

**Situación y tipo de cambio**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `tipoHorizontal` | Tipo de movimiento horizontal | Lista desplegable | Ampliación de funciones · Rotación de funciones · Apoyo a otra área · Cambio de línea de reporte · Otro | — | Sí |
| `esTemporalHorizontal` | ¿Es temporal o permanente? | Lista desplegable | Permanente · Temporal · Por definir | — | Sí |
| `desdeCuandoHorizontal` | ¿Desde cuándo se realiza o realizará? | Fecha | Libre | — | Sí |
| `motivoHorizontal` | ¿Qué necesidad origina el movimiento horizontal? | Párrafo | Libre | 60–600 car. | Sí |

**Qué cambia en el rol**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `funcionesActualesHorizontal` | ¿Qué funciones mantiene en su puesto actual? | Párrafo | Libre | 30–300 car. | Sí |
| `funcionesNuevasHorizontal` | ¿Qué funciones nuevas o distintas asumirá? | Párrafo | Libre | 40–500 car. | Sí |
| `areaApoyoHorizontal` | ¿Con qué área o jefatura coordinará o a quién reportará? | Texto corto | Libre | 3–120 car. | Sí |
| `cambiaJefeHorizontal` | ¿Cambia su jefe directo? | Lista desplegable | Sí · No | — | Sí |
| `cambiaNivelHorizontal` | ¿Cambia su nivel o banda del puesto? | Lista desplegable | Sí · No · Por confirmar | — | Sí |

**Resultado esperado e impacto**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `resultadoEsperadoHorizontal` | ¿Qué se espera lograr con el movimiento? | Párrafo | Libre | 40–500 car. | Sí |
| `solicitaIncrementoHorizontal` | ¿Se solicita compensación adicional (asignación o incremento)? | Lista desplegable | Sí · No · Por confirmar | — | Sí |
| `impactoNoHorizontal` | ¿Qué ocurriría si el movimiento no se realiza? | Párrafo | Libre | 40–500 car. | Sí |

### 2.8 Reestructuración de área (17 preguntas)

**Contexto de la reestructuración**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `areaReestructura` | ¿Qué área o unidad se reestructura? | Texto corto | Libre | 2–100 car. | Sí |
| `fechaVigenciaReestructura` | Fecha propuesta de entrada en vigencia | Fecha | Libre | — | Sí |
| `aprobadaReestructura` | ¿La reestructuración ya fue aprobada por la Dirección o Unidad? | Lista desplegable | Sí · No · Por confirmar | — | Sí |
| `motivoReestructura` | ¿Qué situación origina la reestructuración? | Párrafo | Libre | 60–600 car. | Sí |
| `objetivoReestructura` | ¿Qué se busca lograr con la nueva estructura? | Párrafo | Libre | 60–600 car. | Sí |

**Alcance de los cambios**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `nPersonasAfectadas` | Número de colaboradores afectados | Número | Libre | > 0 | Sí |
| `tipoCambioReestructura` | Principal tipo de cambio | Lista desplegable | Reubicación de personas · Cambio de líneas de reporte · Creación de posiciones · Eliminación de posiciones · Combinación de varios cambios | — | Sí |
| `posicionesCreadas` | Posiciones nuevas que se crean | Lista desplegable | Ninguna · 1 · 2 · 3 o más | — | Sí |
| `posicionesEliminadas` | Posiciones que se eliminan | Lista desplegable | Ninguna · 1 · 2 · 3 o más | — | Sí |
| `detalleMovimientosRest` | Detalle de movimientos: una línea por colaborador (matrícula · nombre · posición actual → posición propuesta · área destino) | Párrafo | Libre | 60–1500 car. | Sí |
| `cambiosReporteRest` | ¿Qué cambios hay en las líneas de reporte? | Párrafo | Libre | 30–300 car. | Sí |

**Impacto económico**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `cambiosSalarialesRest` | ¿La reestructuración implica cambios salariales o de nivel? | Lista desplegable | Sí · No · Por confirmar | — | Sí |
| `impactoPresupuestalRest` | Impacto presupuestal esperado | Lista desplegable | Neutro · Ahorro · Costo adicional · Por determinar | — | Sí |
| `detalleEconomicoRest` | Explique el impacto económico y salarial | Párrafo | Libre | 40–500 car. | Sí |

**Resultado esperado e impacto**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `riesgosPersonasRest` | ¿Qué riesgos hay para el clima o la retención de las personas afectadas? | Párrafo | Libre | 40–500 car. | Sí |
| `resultadoEsperadoRest` | ¿Qué resultado se espera lograr? | Párrafo | Libre | 40–500 car. | Sí |
| `impactoNoRest` | ¿Qué ocurriría si la reestructuración no se ejecuta? | Párrafo | Libre | 40–500 car. | Sí |

### 2.9 Revalorización de puesto (12 preguntas)

**Situación que origina la revisión**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `queCambioRev` | ¿Qué situación origina la revisión del puesto? | Párrafo | Libre | 60–600 car. | Sí |
| `desdeCuandoRev` | ¿Desde cuándo se mantienen estos cambios? | Fecha | Libre | — | Sí |
| `cambioPermanente` | ¿Los cambios son permanentes? | Lista desplegable | Sí · No · Por confirmar | — | Sí |

**Cambios en el puesto**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `nuevasRespRev` | ¿Qué nuevas responsabilidades se incorporaron? | Párrafo | Libre | 40–500 car. | Sí |
| `cambioAlcanceRev` | ¿Cómo cambió el alcance del puesto? | Párrafo | Libre | 40–500 car. | Sí |
| `cambioPersonasRev` | ¿Cambió el número de personas a cargo? | Texto corto | Libre | 1–60 car. | Sí |
| `cambioPresupuestoRev` | ¿Cambió la responsabilidad presupuestal? | Párrafo | Libre | 30–300 car. | Sí |
| `cambioDecisionRev` | ¿Cambió el nivel de decisión? | Párrafo | Libre | 30–300 car. | Sí |
| `funcionesOtroPuesto` | ¿Absorbió funciones de otro puesto? | Párrafo | Libre | 30–300 car. | Sí |

**Sustento**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `sustentoSubvaloracion` | ¿Por qué la valoración actual ya no representa el contenido real del puesto? | Párrafo | Libre | 60–600 car. | Sí |
| `jdActualizada` | ¿Existe descripción de puesto actualizada? | Lista desplegable | Sí · No · En proceso | — | Sí |

**Resultado esperado**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `resultadoEsperadoRev` | ¿Qué se busca corregir o alinear con la revalorización? | Párrafo | Libre | 40–500 car. | Sí |

### 2.10 Convenio / caso especial (6 preguntas)

**El caso**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `tipoCasoEspecial` | Tipo de convenio / caso | Texto corto | Libre | 3–100 car. | Sí |
| `vigenciaCaso` | Vigencia o duración | Texto corto | Libre | 2–60 car. | Sí |
| `objetivoCaso` | ¿Qué necesidad origina la solicitud? | Párrafo | Libre | 60–600 car. | Sí |

**Sustento, resultado e impacto**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `sustentoCaso` | ¿Qué elementos sustentan el caso? | Párrafo | Libre | 60–600 car. | Sí |
| `resultadoEsperadoCaso` | ¿Qué resultado se espera lograr? | Párrafo | Libre | 40–500 car. | Sí |
| `impactoCaso` | ¿Qué ocurriría si no se atiende? | Párrafo | Libre | 40–500 car. | Sí |

### 2.11 Otro (4 preguntas)

**La solicitud**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `descripcionOtro` | ¿Qué movimiento o decisión se solicita? | Párrafo | Libre | 60–600 car. | Sí |
| `sustentoOtro` | ¿Qué situación origina la solicitud? | Párrafo | Libre | 60–600 car. | Sí |

**Resultado esperado e impacto**

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `resultadoEsperadoOtro` | ¿Qué se espera lograr? | Párrafo | Libre | 40–500 car. | Sí |
| `impactoOtro` | ¿Qué ocurriría si no se atiende? | Párrafo | Libre | 40–500 car. | Sí |

## 3. Aprobaciones previas (todos los movimientos)

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `tieneAprobacion` | ¿Cuenta con alguna aprobación previa? | Lista desplegable | Sí · No | — | Sí |
| `ap-level` | Nivel de aprobación | Lista desplegable | Presidencia · Gerencia General · Líder de Unidad · Líder de Área · Líder inmediato · Otro | — | Si hay aprobación |
| `ap-name` | Nombre del aprobador | Texto corto | Libre | 2–100 car. | Si hay aprobación |
| `ap-role` | Cargo del aprobador | Texto corto | Libre | 2–100 car. | Si hay aprobación |
| `ap-date` | Fecha de aprobación | Fecha | Libre | — | Si hay aprobación |
| `ap-evidence` | ¿Cuenta con evidencia? | Lista desplegable | Sí · No | — | Si hay aprobación |
| `ap-type` | Tipo de evidencia | Lista desplegable | Correo · Acta · Reunión · Documento · Otro | — | Solo si hay evidencia |

Se pueden registrar varias aprobaciones (en la web, tarjetas repetibles; en Google Forms, una por formulario).

## 4. Presupuesto (todos los movimientos)

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `presupuesto` | ¿Cuenta con presupuesto? | Lista desplegable | Sí · No · Por confirmar | — | Sí |
| `fuentePresupuesto` | Fuente de presupuesto | Lista desplegable | Presupuesto aprobado · Vacante disponible · Ahorro interno · Reasignación · Presupuesto adicional · No identificada · Otro | — | Sí |
| `validaPresupuesto` | Quién confirma o valida el presupuesto | Texto corto | Libre | 3–120 car. | Sí |
| `montoPresupuesto` | Monto disponible (S/) | Número | Libre | > 0 | Solo si presupuesto = Sí |

## 5. Prioridad e impacto (todos los movimientos)

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `urgencia` | ¿Cuándo se necesita implementar? | Lista desplegable | Inmediato · Dentro de 30 días · Dentro de 60 días · Más adelante | — | Sí |
| `impacto` | Nivel de impacto si no se ejecuta | Lista desplegable | Bajo · Medio · Alto · Crítico | — | Sí |
| `consecuencia` | Principal consecuencia de no aprobar | Lista desplegable | Sin impacto relevante · Retraso operativo · Sobrecarga del equipo · Riesgo de pérdida de talento · Impacto en clientes · Impacto financiero · Riesgo de cumplimiento · Otro | — | Sí |
| `impactoDetalle` | Explique brevemente el impacto | Párrafo | Libre | 40–500 car. | Sí |

## 6. Cierre (solo en la versión web)

| Campo | Pregunta | Tipo de respuesta | Respuestas posibles | Límite | Obligatoria |
|---|---|---|---|---|---|
| `solicitudConcreta` | Sustento ejecutivo para Comité (se genera con las respuestas y es editable) | Párrafo | Libre | 50–3000 car. | Sí |
| `confirmo` | Confirmo que la información es veraz y cuenta con el respaldo indicado | Casilla | Confirmo | — | Sí |

## Resumen

| Movimiento | Preguntas propias |
|---|---|
| Promoción | 12 |
| Encargatura | 21 |
| Reemplazo | 12 |
| Puesto nuevo | 13 |
| Incremento salarial | 12 |
| Movimiento lateral | 11 |
| Movimiento horizontal | 12 |
| Reestructuración de área | 17 |
| Revalorización de puesto | 12 |
| Convenio / caso especial | 6 |
| Otro | 4 |

Cada solicitud además lleva 6 campos de solicitud/líder, 6 de colaborador (o 3 de área), 7 de aprobación, 4 de presupuesto y 4 de prioridad e impacto.

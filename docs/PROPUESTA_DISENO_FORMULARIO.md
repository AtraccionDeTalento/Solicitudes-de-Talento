# Propuesta de diseño del formulario (v2, tras ajustes al banco de preguntas)

Principio: el jefe solo escribe lo que el sistema no puede saber. Todo lo demás se precarga (login, maestro de colaboradores, descriptivo de puesto).

## Resumen de cambios

| Bloque | Antes | Ahora |
|---|---|---|
| Paso 1 Datos | 12 campos | 2 acciones: Tipo de movimiento + Colaborador |
| Paso 3 Aprobación | 1 + 7 campos | 1 + 4 campos (repetible) |
| Paso 2 Promoción | 12 preguntas / 4 grupos | 6 |
| Paso 2 Encargatura | 21 / 6 grupos | 6 base + condicionales (renovación 6, cambio 4) |
| Paso 2 Reemplazo | 10 / 3 grupos | 6 |
| Paso 2 Puesto nuevo | 15 / 4 grupos | 7 |
| Paso 2 Incremento | 12 / 4 grupos | 3 + bloque retención (4) |
| Paso 2 Otro | 5 | 3 |

---

## Parte A · Comunes

### Paso 1 · Datos de la solicitud
1. **Fecha**: automática.
2. **Tipo de movimiento**: Promoción · Encargatura · Reemplazo · Puesto nuevo · Incremento salarial · Movimiento interno · Otro.
3. **Líder solicitante** (nombre, cargo, correo): automático desde el login. No se muestra como pregunta.
4. **Colaborador**: buscador por correo, matrícula o nombre. Autocompleta matrícula, nombre, correo, puesto, departamento, área y sección (Departamento define el HRBP destino).
   - *Puesto nuevo*: este bloque cambia a los datos de la posición solicitada (sin colaborador).
   - *Reemplazo*: aquí el "colaborador" es el que sale; ver B3.

### Paso 3 · Aprobación previa
1. ¿Cuenta con aprobación de la gerencia? Sí / No.
2. Si Sí (repetible con **+ Agregar otra aprobación**):
   - Aprobado por: buscador de persona (autocompleta nombre, cargo/nivel, correo).
   - Fecha de aprobación.
   - Tipo de evidencia: Correo · Acta · Documento · Reunión registrada · Otro.
   - Adjuntar evidencia: archivo/imagen/PDF (obligatorio salvo "Reunión registrada").

Eliminadas: Nivel de aprobación, Cargo y Detalle de evidencia (se derivan o van en el adjunto).

### Paso 4 · Presupuesto (sin cambios de pregunta, ver pendientes)
1. ¿Cuenta con presupuesto? Sí / No.
2. ¿Quién te confirmó que hay presupuesto? HRBP · Talento · Mi gerencia.

### Paso 5 · Prioridad y necesidad (sin cambios)
Fecha tentativa de ingreso · Nivel de impacto · Principal consecuencia · Explicación breve.

> Si el paso 2 ya pide "desde cuándo" y "qué pasa si no se hace", la fecha y la explicación del impacto de este paso se repiten. Propuesta: en Promoción, Reemplazo y Puesto nuevo, **precargar** estos dos campos del paso 5 con la respuesta del paso 2 (editable), o quitar la pregunta de impacto del paso 2 y dejarla solo aquí. Decisión abajo.

### Paso 6 · Sustento ejecutivo y Paso 7 · Confirmación
Sin cambios.

---

## Parte B · Paso 2 por movimiento

### B1. Promoción (6)
1. ¿A qué puesto se propone promover? (texto)
2. ¿Desde cuándo asume o viene realizando las funciones? (fecha)
3. ¿La posición existe y está aprobada en la estructura? Sí · No
4. ¿Qué cambia respecto a su puesto actual? (texto largo; ayuda: responsabilidades, alcance, decisión, equipo, procesos, presupuesto). Absorbe las 4 preguntas de "qué cambió".
5. ¿Por qué se propone a este colaborador? (experiencia, resultados, desempeño). Absorbe el "por qué promoción y no incremento".
6. ¿Qué se busca lograr y qué ocurriría si no se formaliza? (texto breve)

### B2. Encargatura
**Base (6)**
1. Tipo: Nueva · Renovación · Cambio.
2. Situación que genera la necesidad: Vacaciones · Licencia · Vacante · Cese · Proyecto temporal · Otro.
3. Posición que requiere cobertura y a quién reemplaza: selector de colaborador/posición con precarga (ej. persona que sale de licencia).
4. Vigencia: fecha inicio + fecha estimada de fin (+ "ya empezó" se deduce de la fecha de inicio; no se pregunta).
5. Qué cambia temporalmente en sus responsabilidades:
   - ¿Mantiene sus funciones actuales? Sí · No · Parcialmente
   - ¿Equipo adicional a cargo? ¿Cuántos?
   - Responsabilidades adicionales (texto)
6. Objetivo: lista (Continuidad operativa · Continuidad de liderazgo · Cobertura de posición crítica · Cumplimiento de metas · Continuidad de proyecto · Otro) + "¿Qué impacto tendría no formalizarla?" (texto breve).

**Si Renovación (+6):** fecha del primer convenio · vigente hasta · tiempo adicional a renovar · ¿mismas funciones y condiciones? · ¿cambia el monto de la asignación? · ¿qué resultados justifican continuar?

**Si Cambio (+4):** posición encargada anteriormente · nueva posición · ¿por qué se cambia? · ¿cambia la asignación económica?

### B3. Reemplazo (6)
1. ¿A quién reemplaza el colaborador? Selector desde el maestro (nombre y/o posición de quien deja la vacante); autocompleta puesto, departamento, área, sección y descriptivo de puesto. Opción "Sin titular".
2. ¿Cuál es el motivo del reemplazo? Renuncia · Cese · Promoción · Movimiento interno · Otro.
3. ¿Desde cuándo se requiere cubrir la posición? (fecha prevista de ingreso o movimiento)
4. ¿La posición ya está aprobada en la estructura vigente? Sí · No · Por confirmar.
   - Si No: ¿posición adicional o modificación de estructura?
5. ¿Se mantiene el presupuesto de la posición reemplazada? Sí · No · Por confirmar.
   - Si cambia: indicar brevemente qué cambia.
6. ¿Existe algún cambio respecto a la posición reemplazada? "No, se mantiene igual" · "Sí, cambia puesto, responsabilidades, nivel o condiciones".
   - Si Sí: explicar brevemente.
   - Aviso interno al HRBP: "Podría requerir revisión de estructura o valorización; puede no ser un reemplazo 1 a 1".

Respecto a la versión anterior: se quita "impacto de no cubrir" (ya no está en tu lista), se agrega presupuesto, y "Traslado/Cambio interno" pasan a "Movimiento interno".

### B4. Puesto nuevo (7)
1. ¿Qué puesto se solicita crear? (texto)
2. ¿Qué necesidad del negocio origina la creación? (lista motivo: Crecimiento · Reestructuración · Proyecto nuevo · Nueva función · Otro + texto breve)
3. ¿Por qué la estructura actual no puede cubrir esta necesidad? (texto breve)
4. ¿Cuántas posiciones y desde cuándo? (cantidad + fecha)
5. ¿Cómo será la posición? Permanente/Temporal · Reporta a · ¿Personas a cargo? Sí/No + cantidad si aplica.
6. Responsabilidades y resultados principales (un solo campo; apoyado en el descriptivo precargado o adjunto).
7. ¿Qué impacto tendría no crear esta posición? (texto breve)

Eliminada: "¿Qué espera del puesto?" (se solapa con 6 y 7).

### B5. Incremento salarial
**Base (3)**
1. Motivo principal: Retención · Ampliación de responsabilidades · Mérito · Regularización · Obtención de Grado Académico · Otro.
2. Detalle del motivo (qué ocurre y por qué se solicita).
3. ¿Qué ocurriría si no se realiza el incremento?

**Si motivo = Retención (+4):** ¿Riesgo de salida? · ¿Comunicó intención de renuncia? · ¿Existe oferta externa? · si hay oferta, adjuntar evidencia (Correo · Carta oferta · Mensaje · Otro).

### B6. Movimiento interno
Sin preguntas en el documento. Ver pendientes.

### B7. Otro (3)
1. ¿Qué movimiento o cambio se solicita?
2. ¿Por qué se solicita?
3. ¿Qué ocurriría si no se realiza?

---

## Cambios de sistema que implica
- Login → datos del líder (sin preguntas).
- Maestro de colaboradores → autocompletado, y selector de "colaborador que sale" en Reemplazo/Encargatura.
- Descriptivo de puesto (DP) por puesto: precarga en Reemplazo y Puesto nuevo; edición o adjunto si cambia. (Ver proyecto DP pausado en rama `dp-workflow`.)
- Aprobaciones: buscador de personas (maestro) para "Aprobado por".
- Condicionales: Encargatura (renovación/cambio), Incremento (retención), Reemplazo (cambia → DP).

## Pendientes / decisiones tuyas
1. **Presupuesto**: dejaste dos notas sin cerrar: (a) ¿qué puestos necesitan confirmación del HRBP sobre si hay presupuesto?; (b) por qué una posición registrada en Adryan la busca Atracción con otro nombre (parece un tema de homologación de nombres de puesto entre sistemas). Necesito tu criterio para (a); (b) se resuelve con el maestro/DP como fuente única de nombre.
2. **B6 Movimiento interno** no tiene preguntas en el banco. ¿Lo defino yo (propuesta: colaborador, posición/área destino, motivo, desde cuándo, ¿cambia remuneración?, impacto de no hacerlo) o lo mantienes fuera por ahora?
3. **Duplicidad paso 2 vs paso 5** (fecha e impacto): ¿precargar o quitar de uno? Recomiendo precargar.
4. Reemplazo: ahora preguntas "¿A quién reemplaza el colaborador?", lo que sugiere que el "colaborador" del paso 1 es el que **entra** (o aún no existe). Confirma: ¿en Reemplazo el paso 1 identifica al que sale o al que entra? Si entra y aún no hay persona, se usaría el mismo bloque que Puesto nuevo.
5. Reemplazo ya trae su propia pregunta de presupuesto (5) y el paso 4 también: ¿se mantiene el paso 4 o la pregunta 5 lo sustituye en este movimiento?
6. Reemplazo sin "impacto de no cubrir": el paso 5 ya lo pide (nivel de impacto + explicación), así que queda cubierto.

// Motor de redacción ejecutiva (determinista): arma el texto que lee Gerencia a partir de los datos de la solicitud.
// Garantías: no inventa nada. Cada dato sale de un campo del formulario, las respuestas del jefe se copian TAL CUAL (solo se ordenan en secciones fijas)
// y las cifras no se transforman. Lo que falta o no cuadra se lista aparte en «Puntos a validar». tests/redactor.test.js verifica estas garantías.
// La capa de IA (más adelante) solo podrá reescribir este texto y se descartará si cambia un dato.

// Bloque del cuestionario → sección ejecutiva. Si app.js agrega un bloque nuevo, tests/redactor.test.js falla hasta que se clasifique aquí.
const GRUPO_DE = {
  'Cambio propuesto': 'propuesta', 'Qué cambió en el rol': 'rol', 'Sustento de la promoción': 'sustento',
  'Tipo y motivo': 'situacion', 'Vigencia': 'condiciones', 'Condiciones de la renovación': 'condiciones', 'Condiciones del cambio': 'condiciones', 'Funciones durante la encargatura': 'rol',
  'Posición a reemplazar': 'situacion', 'Colaborador propuesto': 'propuesta', 'Cambios en el rol': 'rol',
  'El puesto solicitado': 'propuesta', 'Necesidad del negocio': 'situacion', 'Alcance del puesto': 'rol',
  'Motivo y situación': 'situacion', 'Evidencia y riesgo de salida': 'sustento', 'Resultado esperado': 'resultado', 'Propuesta del negocio': 'economico',
  'Necesidad': 'situacion', 'Destino': 'propuesta', 'Situación y tipo de cambio': 'situacion', 'Qué cambia en el rol': 'rol',
  'Contexto de la reestructuración': 'situacion', 'Alcance de los cambios': 'propuesta', 'Impacto económico': 'economico',
  'Situación que origina la revisión': 'situacion', 'Cambios en el puesto': 'rol', 'Sustento': 'sustento',
  'El caso': 'situacion', 'Sustento, resultado e impacto': 'sustento', 'La solicitud': 'situacion', 'Resultado esperado e impacto': 'resultado'
};
export const BLOQUES_CONOCIDOS = Object.keys(GRUPO_DE);
const SECCIONES = [['situacion', 'Situación y necesidad'], ['propuesta', 'Propuesta'], ['rol', 'Rol y alcance'], ['sustento', 'Sustento y evidencia'],
  ['condiciones', 'Vigencia y condiciones'], ['economico', 'Economía y presupuesto'], ['resultado', 'Resultado esperado e impacto'], ['otros', 'Otros antecedentes']];

// Datos mínimos por movimiento: si faltan, el motor lo avisa.
export const REQUERIDOS = {
  'Promoción': { puestoPropuesto: 'puesto propuesto', desdeCuando: 'fecha desde la que ejerce las funciones', queCambioPromo: 'qué cambió en el rol' },
  'Encargatura': { puestoEncargado: 'posición que requiere cobertura', fechaInicioEnc: 'fecha de inicio', fechaFinEnc: 'fecha de fin' },
  'Reemplazo': { puestoReemplazo: 'posición a reemplazar', fechaInicioReemplazo: 'fecha de inicio', porQueColaboradorReemplazo: 'por qué se propone al colaborador' },
  'Puesto nuevo': { puestoNuevo: 'nombre del puesto', necesidadPuesto: 'necesidad del negocio', fechaRequerida: 'fecha requerida' },
  'Incremento salarial': { motivoIncremento: 'motivo del incremento', propuestaNegocio: 'valor de la propuesta', evidenciaRiesgo: 'evidencia de respaldo' },
  'Movimiento lateral': { puestoDestino: 'puesto destino', motivoMovimiento: 'necesidad que origina el movimiento' },
  'Movimiento horizontal': { tipoHorizontal: 'tipo de movimiento', motivoHorizontal: 'necesidad que origina el movimiento', funcionesNuevasHorizontal: 'funciones nuevas' },
  'Reestructuración de área': { areaReestructura: 'área que se reestructura', nPersonasAfectadas: 'colaboradores afectados', fechaVigenciaReestructura: 'fecha de vigencia' },
  'Revalorización de puesto': { queCambioRev: 'situación que origina la revisión', sustentoSubvaloracion: 'sustento de la revalorización' },
  'Convenio / caso especial': { tipoCasoEspecial: 'tipo de convenio o caso', objetivoCaso: 'necesidad que origina la solicitud' },
  'Otro': { descripcionOtro: 'qué se solicita', sustentoOtro: 'situación que origina la solicitud' }
};
const CON_COSTO = ['Promoción', 'Encargatura', 'Reemplazo', 'Puesto nuevo', 'Incremento salarial', 'Reestructuración de área', 'Revalorización de puesto'];

const limpio = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const fecha = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(limpio(s)); return m ? `${m[3]}/${m[2]}/${m[1]}` : limpio(s); };
const minus = s => { s = limpio(s); return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; };
const fin = s => { s = limpio(s); return s && !/[.!?:;)]$/.test(s) && s.length > 45 ? s + '.' : s; };   // solo cierra frases largas; no toca el contenido
const etiqueta = p => limpio(p).replace(/^¿/, '').replace(/\?$/, '').replace(/:$/, '');

/** Importe o porcentaje tal como lo escribió el jefe (sin reformatear cifras). */
const importe = (tipo, valor) => { valor = limpio(valor); if (!valor) return ''; return /porcentaje/i.test(tipo || '') ? `${valor}%` : `S/ ${valor}`; };

/** registro: documento de la solicitud (campos planos + levantamiento [{i,b,p,r}] + aprobaciones). Devuelve { titulo, texto, secciones, alertas, hechos }. */
export function redactar(r, opciones = {}) {
  const mov = limpio(r.movimiento) || 'Solicitud';
  const lev = Array.isArray(r.levantamiento) ? r.levantamiento.filter(x => x && limpio(x.r) !== '') : [];
  const v = id => { const x = lev.find(y => y.i === id); return x ? limpio(x.r) : ''; };
  const sinPersona = ['Puesto nuevo', 'Reestructuración de área'].includes(mov);
  const nombre = limpio(r.colaborador), cod = limpio(r.codigo);
  const persona = sinPersona ? '' : [nombre, cod && cod !== 'No aplica' ? `(${cod})` : ''].filter(Boolean).join(' ') + (limpio(r.puestoActual) && limpio(r.puestoActual) !== 'No aplica' ? `, ${limpio(r.puestoActual)}` : '');
  const hechos = [];   // trazabilidad: de qué campo salió cada dato del resumen
  const usa = (id, texto) => { if (texto) hechos.push({ campo: id, valor: texto }); return texto; };
  const F = id => usa(id, fecha(v(id)));
  const T = id => usa(id, v(id));

  // ---- 1. Decisión que se solicita (una frase construida solo con datos del formulario)
  const cantidad = () => { const n = T('cantidadPosiciones'); return n && n !== '1' ? ` (${n} posiciones)` : ''; };
  const clausula = {
    'Promoción': () => `la promoción de ${persona}${T('puestoPropuesto') ? ` al puesto de ${v('puestoPropuesto')}` : ''}${F('desdeCuando') ? `, con funciones desde ${fecha(v('desdeCuando'))}` : ''}`,
    'Encargatura': () => `${T('tipoEncargatura') ? 'la ' + minus(v('tipoEncargatura')) : 'la encargatura'} de ${persona}${T('puestoEncargado') ? ` en la posición de ${v('puestoEncargado')}` : ''}${T('aQuienReemplaza') ? `, en reemplazo de ${v('aQuienReemplaza')}` : ''}${F('fechaInicioEnc') && F('fechaFinEnc') ? `, del ${fecha(v('fechaInicioEnc'))} al ${fecha(v('fechaFinEnc'))}` : F('fechaInicioEnc') ? `, desde ${fecha(v('fechaInicioEnc'))}` : ''}`,
    'Reemplazo': () => `que ${persona} asuma la posición de ${T('puestoReemplazo') || 'la posición indicada'}${cantidad()}${T('personaOVacanteReemplazo') ? `, en reemplazo de ${v('personaOVacanteReemplazo')}` : ''}${F('fechaInicioReemplazo') ? `, desde ${fecha(v('fechaInicioReemplazo'))}` : ''}`,
    'Puesto nuevo': () => `la creación del puesto ${T('puestoNuevo') || 'indicado'}${cantidad()}${T('temporalPermanente') ? ` (${minus(v('temporalPermanente'))})` : ''}${T('reportaA') ? `, con reporte a ${v('reportaA')}` : ''}${F('fechaRequerida') ? `, requerido para ${fecha(v('fechaRequerida'))}` : ''}`,
    'Incremento salarial': () => `un incremento salarial para ${persona}${T('motivoIncremento') ? `, por ${minus(v('motivoIncremento'))}` : ''}${v('propuestaNegocio') ? `, con una propuesta de ${usa('propuestaNegocio', importe(v('tipoPropuestaNegocio'), v('propuestaNegocio')))}` : ''}`,
    'Movimiento lateral': () => `el movimiento lateral de ${persona}${T('puestoDestino') ? ` al puesto de ${v('puestoDestino')}` : ''}${T('areaDestino') ? `, en ${v('areaDestino')}` : ''}`,
    'Movimiento horizontal': () => `un movimiento horizontal${T('tipoHorizontal') ? ` (${minus(v('tipoHorizontal'))})` : ''} para ${persona}${T('esTemporalHorizontal') ? `, de carácter ${minus(v('esTemporalHorizontal'))}` : ''}${F('desdeCuandoHorizontal') ? `, desde ${fecha(v('desdeCuandoHorizontal'))}` : ''}`,
    'Reestructuración de área': () => `la reestructuración de ${T('areaReestructura') || 'un área'}${T('nPersonasAfectadas') ? `, que afecta a ${v('nPersonasAfectadas')} colaborador(es)` : ''}${F('fechaVigenciaReestructura') ? `, con vigencia desde ${fecha(v('fechaVigenciaReestructura'))}` : ''}`,
    'Revalorización de puesto': () => `la revalorización del puesto de ${persona}${F('desdeCuandoRev') ? `, por cambios vigentes desde ${fecha(v('desdeCuandoRev'))}` : ''}`,
    'Convenio / caso especial': () => `un ${minus(T('tipoCasoEspecial') || 'convenio o caso especial')} para ${persona}${T('vigenciaCaso') ? `, con vigencia ${v('vigenciaCaso')}` : ''}`,
    'Otro': () => `lo siguiente: ${T('descripcionOtro') || 'ver detalle'}`
  }[mov];
  const partes = [`Se solicita ${clausula ? clausula() : 'una decisión de talento'}.`];
  const pres = limpio(r.presupuesto);
  if (pres) partes.push(`Presupuesto: ${pres}${limpio(r.fuentePresupuesto) ? ` (${limpio(r.fuentePresupuesto)})` : ''}${limpio(r.montoPresupuesto) && limpio(r.montoPresupuesto) !== '0' ? `, S/ ${limpio(r.montoPresupuesto)}` : ''}.`);
  if (limpio(r.urgencia) || limpio(r.impacto)) partes.push(`Urgencia: ${limpio(r.urgencia) || 'no indicada'}. Impacto si no se ejecuta: ${limpio(r.impacto) || 'no indicado'}${limpio(r.consecuencia) ? ` (${minus(r.consecuencia)})` : ''}.`);
  const resumen = partes.join(' ');

  // ---- 2. Secciones: las respuestas del jefe, tal cual, agrupadas por el bloque del cuestionario
  const grupos = {}; SECCIONES.forEach(([k]) => { grupos[k] = []; });
  for (const x of lev) {
    if (x.i === 'tipoPropuestaNegocio') continue;   // ya va dentro de la propuesta (monto o porcentaje)
    const g = GRUPO_DE[x.b] || 'otros';
    const prop = x.i === 'propuestaNegocio';
    grupos[g].push({ etiqueta: prop ? 'Propuesta del negocio' : etiqueta(x.p), texto: prop ? importe(v('tipoPropuestaNegocio'), x.r) : fecha(x.r) });
  }
  if (limpio(r.impactoDetalle)) grupos.resultado.push({ etiqueta: 'Qué ocurre si no se ejecuta', texto: limpio(r.impactoDetalle) });
  const pre = [];
  if (pres) pre.push({ etiqueta: '¿Cuenta con presupuesto?', texto: pres });
  if (limpio(r.fuentePresupuesto)) pre.push({ etiqueta: 'Fuente de presupuesto', texto: limpio(r.fuentePresupuesto) });
  if (limpio(r.validaPresupuesto)) pre.push({ etiqueta: 'Quién valida el presupuesto', texto: limpio(r.validaPresupuesto) });
  if (limpio(r.montoPresupuesto)) pre.push({ etiqueta: 'Monto disponible', texto: `S/ ${limpio(r.montoPresupuesto)}` });
  grupos.economico = [...pre, ...grupos.economico];
  const secciones = SECCIONES.map(([k, titulo]) => ({ clave: k, titulo, items: grupos[k] })).filter(s => s.items.length);

  const aprob = (Array.isArray(r.aprobaciones) ? r.aprobaciones : []).filter(a => a && (limpio(a.name) || limpio(a.level)));
  if (aprob.length) secciones.push({ clave: 'aprobaciones', titulo: 'Aprobaciones previas', items: aprob.map(a => ({ etiqueta: limpio(a.level) || 'Aprobación', texto: [limpio(a.name), limpio(a.role)].filter(Boolean).join(', ') + (limpio(a.date) ? ` · ${fecha(a.date)}` : '') + (limpio(a.evidence) ? ` · evidencia: ${limpio(a.evidence)}${limpio(a.type) ? ' (' + limpio(a.type) + ')' : ''}` : '') })) });
  if (limpio(r.puntaje)) {
    const it = [{ etiqueta: 'Índice de preparación', texto: `${limpio(r.puntaje)}/100${limpio(r.clasificacion) ? ' · ' + limpio(r.clasificacion) : ''}` }];
    if (limpio(r.fortalezas)) it.push({ etiqueta: 'Fortalezas', texto: limpio(r.fortalezas).split(' | ').join('; ') });
    if (limpio(r.alertas)) it.push({ etiqueta: 'Alertas del sistema', texto: limpio(r.alertas).split(' | ').join('; ') });
    secciones.push({ clave: 'evaluacion', titulo: 'Evaluación de preparación', items: it });
  }

  // ---- 3. Puntos a validar (reglas fijas)
  const alertas = [];
  for (const [id, nombreCampo] of Object.entries(REQUERIDOS[mov] || {})) if (!v(id)) alertas.push(`Falta ${nombreCampo}.`);
  if (CON_COSTO.includes(mov)) {
    if (pres && pres !== 'Sí') alertas.push(`El presupuesto no está confirmado (${pres}).`);
    if (pres === 'Sí' && (!limpio(r.montoPresupuesto) || Number(limpio(r.montoPresupuesto)) === 0)) alertas.push('Indica que cuenta con presupuesto pero no registra el monto.');
    if (pres === 'Sí' && !limpio(r.validaPresupuesto)) alertas.push('No indica quién valida el presupuesto.');
  }
  if (limpio(r.tieneAprobacion) === 'Sí' && !aprob.length) alertas.push('Declara aprobaciones previas pero no registra ninguna.');
  aprob.filter(a => limpio(a.evidence) === 'No').forEach(a => alertas.push(`La aprobación de ${limpio(a.name) || limpio(a.level)} no tiene evidencia.`));
  const ini = v('fechaInicioEnc'), fn = v('fechaFinEnc');
  if (/^\d{4}-\d{2}-\d{2}$/.test(ini) && /^\d{4}-\d{2}-\d{2}$/.test(fn) && fn < ini) alertas.push('La fecha de fin de la encargatura es anterior a la de inicio.');
  const pt = Number(limpio(r.puntaje)); if (limpio(r.puntaje) && pt < 60) alertas.push(`Índice de preparación bajo (${pt}/100).`);
  if (limpio(r.alertas)) limpio(r.alertas).split(' | ').forEach(a => alertas.push(`Alerta del sistema: ${a}`));

  // ---- 4. Texto final
  const titulo = `SOLICITUD DE ${mov.toUpperCase()}${sinPersona ? '' : ' · ' + nombre}`;
  const linea = [limpio(r.cliente) && `Solicitado por: ${limpio(r.cliente)}${limpio(r.cargoCliente) ? ', ' + limpio(r.cargoCliente) : ''}`, [limpio(r.departamento), limpio(r.area), limpio(r.seccion)].filter(Boolean).join(' / '), limpio(r.fechaSolicitud) && `Fecha de solicitud: ${fecha(r.fechaSolicitud)}`].filter(Boolean).join(' · ');
  const out = [titulo, linea, '', '1. DECISIÓN QUE SE SOLICITA', resumen];
  secciones.forEach((s, i) => { out.push('', `${i + 2}. ${s.titulo.toUpperCase()}`); s.items.forEach(it => out.push(`• ${it.etiqueta}: ${fin(it.texto)}`)); });
  if (alertas.length) { out.push('', 'PUNTOS A VALIDAR'); alertas.forEach(a => out.push(`⚠ ${a}`)); }
  if (limpio(opciones.comentarioBP)) out.push('', 'OBSERVACIÓN DEL BUSINESS PARTNER', limpio(opciones.comentarioBP));
  return { titulo, resumen, secciones, alertas, hechos, texto: out.filter(l => l !== undefined).join('\n') };
}

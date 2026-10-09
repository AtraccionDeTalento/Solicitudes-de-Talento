// Indicadores del tablero gerencial (cálculo puro, sin pantalla): lo usa panel.js y lo prueba tests/tablero.test.js.
// «Pendiente» = enviada a Gerencia y aún sin decisión. Gerencia solo ve estados Enviado a Gerencia, Aprobado y Rechazado.
export const URGENTES = ['Inmediato', 'Dentro de 30 días'];
export const PUNTAJE_BAJO = 60;

const num = x => { const s = String(x == null ? '' : x).trim(); const n = Number(s); return s !== '' && Number.isFinite(n) ? n : null; };
const dias = (iso, hoy) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); if (!m) return null;
  return Math.max(0, Math.floor((Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()) - Date.UTC(+m[1], +m[2] - 1, +m[3])) / 864e5));
};
const estadoDe = f => f.estado || 'Nuevo';

export function metricas(filas, periodo, hoy = new Date()) {
  const periodos = [...new Set(filas.map(f => f.periodo).filter(Boolean))].sort().reverse();
  const F = periodo ? filas.filter(f => f.periodo === periodo) : filas.slice();
  const por = e => F.filter(f => estadoDe(f) === e);
  const pend = por('Enviado a Gerencia'), apr = por('Aprobado'), rec = por('Rechazado');
  const total = F.length, resueltas = apr.length + rec.length, pct = n => (total ? Math.round(n / total * 100) : 0);
  const pts = F.map(f => num(f.puntaje)).filter(n => n !== null && n > 0);
  const ant = pend.map(f => dias(f.fechaSolicitud, hoy)).filter(n => n !== null);
  const rank = (k, max = 6) => {
    const m = {}; F.forEach(f => { const x = f[k] || '—'; m[x] = (m[x] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, max);
  };
  return {
    periodos, total, pendientes: pend.length, aprobadas: apr.length, rechazadas: rec.length, resueltas, pctResueltas: pct(resueltas),
    puntajePromedio: pts.length ? Math.round(pts.reduce((a, b) => a + b, 0) / pts.length) : null,
    flujo: [['Recibidas', total], ['Pendientes', pend.length], ['Aprobadas', apr.length], ['Rechazadas', rec.length]].map(([etapa, n]) => ({ etapa, n, pct: pct(n) })),
    atencion: {
      urgentes: pend.filter(f => URGENTES.includes(f.urgencia)).length, inmediatas: pend.filter(f => f.urgencia === 'Inmediato').length,
      masAntiguo: ant.length ? Math.max(...ant) : null,
      bajos: pend.filter(f => { const n = num(f.puntaje); return n !== null && n > 0 && n < PUNTAJE_BAJO; }).length
    },
    porMovimiento: rank('movimiento'), porDepartamento: rank('departamento'), porBP: rank('bp')
  };
}

/** Filas de la bandeja según los filtros del tablero (todos opcionales). */
export function aplicarFiltros(filas, f = {}) {
  const q = String(f.q || '').toLowerCase().trim();
  const pendiente = x => estadoDe(x) === 'Enviado a Gerencia';
  return filas.filter(x =>
    (!f.periodo || x.periodo === f.periodo) && (!f.estado || estadoDe(x) === f.estado) &&
    (!f.movimiento || x.movimiento === f.movimiento) && (!f.departamento || x.departamento === f.departamento) && (!f.bp || (x.bp || '—') === f.bp) &&
    (f.atencion !== 'urgentes' || (pendiente(x) && URGENTES.includes(x.urgencia))) &&
    (f.atencion !== 'bajos' || (pendiente(x) && num(x.puntaje) !== null && num(x.puntaje) > 0 && num(x.puntaje) < PUNTAJE_BAJO)) &&
    (f.atencion !== 'pendientes' || pendiente(x)) &&
    (!q || [x.colaborador, x.area, x.movimiento, x.departamento, x.cliente, x.bp, x.id].join(' ').toLowerCase().includes(q))
  ).sort((a, b) => String(b.enviadoEl || b.fechaSolicitud).localeCompare(String(a.enviadoEl || a.fechaSolicitud)));
}

const URG_RANK = { 'Inmediato': 0, 'Dentro de 30 días': 1, 'Dentro de 60 días': 2, 'Más adelante': 3 };

/** Lo que Gerencia debe decidir ya: pendientes ordenadas por urgencia y, a igual urgencia, por antigüedad. */
export function prioridad(filas, hoy = new Date(), max = 6) {
  return filas.filter(f => estadoDe(f) === 'Enviado a Gerencia')
    .map(f => ({ ...f, dias: dias(f.fechaSolicitud, hoy) }))
    .sort((a, b) => (URG_RANK[a.urgencia] ?? 4) - (URG_RANK[b.urgencia] ?? 4) || (b.dias ?? -1) - (a.dias ?? -1))
    .slice(0, max);
}

/** Por movimiento: cuántas están pendientes, aprobadas y rechazadas (para barras apiladas). */
export function movimientoPorEstado(filas, max = 6) {
  const m = {};
  filas.forEach(f => { const k = f.movimiento || '—', e = estadoDe(f); const r = (m[k] ||= { movimiento: k, pendientes: 0, aprobadas: 0, rechazadas: 0, total: 0 });
    if (e === 'Aprobado') r.aprobadas++; else if (e === 'Rechazado') r.rechazadas++; else r.pendientes++; r.total++; });
  return Object.values(m).sort((a, b) => b.total - a.total || a.movimiento.localeCompare(b.movimiento)).slice(0, max);
}

/** Solicitudes por mes (de más antiguo a más reciente), con resultado. */
export function tendencia(filas, meses = 6) {
  const m = {};
  filas.forEach(f => { if (!f.periodo) return; const r = (m[f.periodo] ||= { periodo: f.periodo, total: 0, aprobadas: 0, rechazadas: 0 }); r.total++; if (estadoDe(f) === 'Aprobado') r.aprobadas++; if (estadoDe(f) === 'Rechazado') r.rechazadas++; });
  return Object.values(m).sort((a, b) => a.periodo.localeCompare(b.periodo)).slice(-meses);
}

/** Frases de lectura rápida para explicar el tablero (sin inventar nada: solo cuentas). */
export function lecturas(M, mov, depto) {
  const l = [];
  if (!M.total) return ['Todavía no hay solicitudes en este periodo.'];
  l.push(M.pendientes ? `${M.pendientes} ${M.pendientes === 1 ? 'solicitud espera' : 'solicitudes esperan'} tu decisión${M.atencion.urgentes ? `, ${M.atencion.urgentes} de ellas urgente${M.atencion.urgentes === 1 ? '' : 's'}` : ''}.` : 'No tienes solicitudes pendientes de decisión.');
  if (mov) l.push(`El movimiento más solicitado es «${mov[0]}» (${mov[1]} de ${M.total}).`);
  if (depto) l.push(`${depto[0]} es el departamento con más solicitudes (${depto[1]}).`);
  if (M.resueltas) l.push(`De lo ya resuelto, el ${Math.round(M.aprobadas / M.resueltas * 100)}% fue aprobado.`);
  return l;
}

/** Indicadores del Business Partner: su trabajo del día a día. */
export function metricasBP(filas, hoy = new Date()) {
  const e = x => filas.filter(f => estadoDe(f) === x);
  const revisar = filas.filter(f => ['Nuevo', 'En revisión BP'].includes(estadoDe(f)));
  const cubo = [['Hasta 2 días', 0, 2], ['3 a 7 días', 3, 7], ['8 a 15 días', 8, 15], ['Más de 15 días', 16, 1e9]]
    .map(([etiqueta, a, b]) => ({ etiqueta, n: revisar.filter(f => { const d = dias(f.fechaSolicitud, hoy); return d !== null && d >= a && d <= b; }).length }));
  const apr = e('Aprobado').length, rec = e('Rechazado').length, esc = e('Enviado a Gerencia').length;
  return {
    total: filas.length, porRevisar: revisar.length, devueltas: e('Devuelto al jefe').length, enGerencia: esc, enPausa: e('En pausa').length, aprobadas: apr, rechazadas: rec,
    tasaAprobacion: apr + rec ? Math.round(apr / (apr + rec) * 100) : null, antiguedad: cubo,
    cola: revisar.map(f => ({ ...f, dias: dias(f.fechaSolicitud, hoy) })).sort((a, b) => (URG_RANK[a.urgencia] ?? 4) - (URG_RANK[b.urgencia] ?? 4) || (b.dias ?? -1) - (a.dias ?? -1)).slice(0, 6),
    porMovimiento: Object.entries(filas.reduce((m, f) => (m[f.movimiento || '—'] = (m[f.movimiento || '—'] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1]).slice(0, 6)
  };
}

/** Distribución de la preparación de los casos (puntaje) en cinco tramos. */
export function histogramaPuntaje(filas) {
  const t = [['Menos de 40', 0, 39], ['40 a 59', 40, 59], ['60 a 74', 60, 74], ['75 a 84', 75, 84], ['85 o más', 85, 100]].map(([etiqueta, a, b]) => ({ etiqueta, a, b, n: 0 }));
  filas.forEach(f => { const p = num(f.puntaje); if (p === null || p <= 0) return; const x = t.find(y => p >= y.a && p <= y.b); if (x) x.n++; });
  return t;
}

/** Mapa de calor: departamentos con más solicitudes × movimientos más pedidos. */
export function mapaCalor(filas, nf = 6, nc = 5) {
  const top = k => Object.entries(filas.reduce((m, f) => (m[f[k] || '—'] = (m[f[k] || '—'] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, k === 'departamento' ? nf : nc).map(x => x[0]);
  const filasK = top('departamento'), cols = top('movimiento');
  const celdas = filasK.map(d => cols.map(m => filas.filter(f => (f.departamento || '—') === d && (f.movimiento || '—') === m).length));
  return { filas: filasK, columnas: cols, celdas, max: Math.max(1, ...celdas.flat()) };
}

/** Solicitudes recibidas por semana (la última es la semana actual). */
export function porSemana(filas, hoy = new Date(), n = 8) {
  const out = Array(n).fill(0);
  filas.forEach(f => { const d = dias(f.fechaSolicitud, hoy); if (d === null) return; const w = Math.floor(d / 7); if (w < n) out[n - 1 - w]++; });
  return out;
}

/** Pendientes de Gerencia por urgencia, en el orden de prioridad. */
export function urgenciaPendientes(filas) {
  const orden = ['Inmediato', 'Dentro de 30 días', 'Dentro de 60 días', 'Más adelante'];
  return orden.map(u => [u, filas.filter(f => estadoDe(f) === 'Enviado a Gerencia' && f.urgencia === u).length]);
}

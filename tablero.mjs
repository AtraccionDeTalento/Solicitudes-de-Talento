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

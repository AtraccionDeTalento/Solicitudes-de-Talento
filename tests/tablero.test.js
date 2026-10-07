// Pruebas de los indicadores del tablero gerencial (tablero.mjs). Ejecutar: node tests/tablero.test.js
const assert = require('assert');
const { metricas, aplicarFiltros } = require('../tablero.mjs');
let n = 0; const ok = (t, f) => { f(); n++; console.log('  ✓', t); };
const hoy = new Date(2026, 9, 10);   // 10-oct-2026
const fila = (id, extra) => ({ id, periodo: '2026-10', fechaSolicitud: '2026-10-07', estado: 'Enviado a Gerencia', movimiento: 'Promoción', departamento: 'RECTORADO', bp: 'Ana', urgencia: 'Dentro de 30 días', puntaje: '80', cliente: 'Luis', colaborador: 'Persona ' + id, ...extra });
const filas = [
  fila('A'), fila('B', { estado: 'Aprobado', movimiento: 'Puesto nuevo', departamento: 'ESCUELA DE POSGRADO', puntaje: '96' }),
  fila('C', { estado: 'Rechazado', puntaje: '40', bp: 'Beto' }), fila('D', { urgencia: 'Inmediato', puntaje: '55', fechaSolicitud: '2026-10-01', bp: 'Beto' }),
  fila('E', { periodo: '2026-09', estado: 'Aprobado', fechaSolicitud: '2026-09-20' })
];

ok('indicadores del periodo: totales, por revisar, aprobadas, rechazadas y % resueltas', () => {
  const m = metricas(filas, '2026-10', hoy);
  assert.deepStrictEqual([m.total, m.pendientes, m.aprobadas, m.rechazadas, m.resueltas, m.pctResueltas], [4, 2, 1, 1, 2, 50]);
  assert.deepStrictEqual(m.periodos, ['2026-10', '2026-09']);
});
ok('puntaje promedio redondeado y vacío si no hay puntajes', () => {
  assert.strictEqual(metricas(filas, '2026-10', hoy).puntajePromedio, Math.round((80 + 96 + 40 + 55) / 4));
  assert.strictEqual(metricas([fila('Z', { puntaje: '' })], '', hoy).puntajePromedio, null);
});
ok('casos que requieren atención: urgentes, inmediatas, antigüedad y preparación baja (solo pendientes)', () => {
  const a = metricas(filas, '2026-10', hoy).atencion;
  assert.deepStrictEqual(a, { urgentes: 2, inmediatas: 1, masAntiguo: 9, bajos: 1 });   // C (rechazada, 40) no cuenta: ya no está pendiente
});
ok('flujo y rankings por movimiento, departamento y Business Partner', () => {
  const m = metricas(filas, '2026-10', hoy);
  assert.deepStrictEqual(m.flujo.map(x => [x.etapa, x.n, x.pct]), [['Recibidas', 4, 100], ['Pendientes', 2, 50], ['Aprobadas', 1, 25], ['Rechazadas', 1, 25]]);
  assert.deepStrictEqual(m.porMovimiento[0], ['Promoción', 3]);
  assert.deepStrictEqual(m.porBP, [['Ana', 2], ['Beto', 2]]);   // empate: orden alfabético estable
});
ok('sin datos no hay divisiones por cero', () => {
  const m = metricas([], '', hoy);
  assert.deepStrictEqual([m.total, m.pctResueltas, m.puntajePromedio, m.atencion.masAntiguo], [0, 0, null, null]);
  assert.deepStrictEqual(m.flujo.map(x => x.pct), [0, 0, 0, 0]);
});
ok('filtros de la bandeja: estado, movimiento, BP, atención y búsqueda; más recientes primero', () => {
  const ids = f => aplicarFiltros(filas, f).map(x => x.id);
  assert.deepStrictEqual(ids({ periodo: '2026-10', estado: 'Aprobado' }), ['B']);
  assert.deepStrictEqual(ids({ periodo: '2026-10', bp: 'Beto' }).sort(), ['C', 'D']);
  assert.deepStrictEqual(ids({ periodo: '2026-10', atencion: 'urgentes' }).sort(), ['A', 'D']);
  assert.deepStrictEqual(ids({ periodo: '2026-10', atencion: 'bajos' }), ['D']);
  assert.deepStrictEqual(ids({ periodo: '2026-10', movimiento: 'Puesto nuevo' }), ['B']);
  assert.deepStrictEqual(ids({ q: 'persona c' }), ['C']);
  assert.strictEqual(ids({}).length, 5);
});
console.log('\n' + n + ' pruebas del tablero OK');

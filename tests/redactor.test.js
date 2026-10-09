// Pruebas del motor de redacción ejecutiva (redactor.mjs). Ejecutar: node tests/redactor.test.js
const fs = require('fs'), path = require('path'), assert = require('assert'), vm = require('vm');
const { redactar, BLOQUES_CONOCIDOS, REQUERIDOS } = require('../redactor.mjs');
let n = 0; const ok = (t, f) => { f(); n++; console.log('  ✓', t); };

// Preguntas reales de la app (SETS de app.js): el motor se prueba contra ellas, así que si cambian el cuestionario las pruebas lo notan.
const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8').replace(/\r\n/g, '\n');
const a = src.search(/const SETS\s*=\s*\{/); let i = src.indexOf('{', a), d = 0, j = i;
for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (!d) break; } }
const SETS = vm.runInNewContext('const SN=["Sí","No"],SNP=["Sí","No","Parcialmente"],SNC=["Sí","No","Por confirmar"],SNS=["Sí","No","No se sabe"];(' + src.slice(i, j + 1) + ')');

/** Registro completo como lo guarda la app: respuestas inventadas para TODAS las preguntas del movimiento. */
function registro(mov, extra = {}) {
  const lev = [];
  SETS[mov].forEach(b => b.q.forEach(q => {
    const tipo = q[2], opc = Array.isArray(q[3]) ? q[3] : null;
    const r = tipo === 'date' ? '2026-11-15' : tipo === 'number' ? '7' : opc ? opc[0] : `Respuesta de ${q[0]} con texto suficiente para la prueba`;
    lev.push({ i: q[0], b: b.t, p: q[1], r });
  }));
  return { movimiento: mov, colaborador: 'Ana Pérez Soto', codigo: '0000001234', puestoActual: 'ANALISTA', cliente: 'Luis Gómez', cargoCliente: 'Jefe de área', departamento: 'RECTORADO', area: 'AREA X', seccion: 'SEC Y',
    fechaSolicitud: '2026-10-07', presupuesto: 'Sí', fuentePresupuesto: 'Presupuesto aprobado', validaPresupuesto: 'Finanzas', montoPresupuesto: '4500', urgencia: 'Dentro de 30 días', impacto: 'Alto', consecuencia: 'Retraso operativo',
    impactoDetalle: 'Se afecta la continuidad del área si no se ejecuta.', tieneAprobacion: 'Sí', aprobaciones: [{ level: 'Líder de Unidad', name: 'María Ríos', role: 'Directora', date: '2026-10-01', evidence: 'Sí', type: 'Correo' }],
    puntaje: '96', clasificacion: 'Caso bien preparado', fortalezas: 'Información completa | Sustento sólido', alertas: '', levantamiento: lev, ...extra };
}
const MOVS = Object.keys(SETS);

ok('cubre los 7 tipos de movimiento y todos los bloques del cuestionario', () => {
  assert.strictEqual(MOVS.length, 7);
  const bloques = new Set(MOVS.flatMap(m => SETS[m].map(b => b.t)));
  bloques.forEach(b => assert.ok(BLOQUES_CONOCIDOS.includes(b), 'bloque sin clasificar en redactor.mjs: ' + b));
  MOVS.forEach(m => Object.keys(REQUERIDOS[m] || {}).forEach(id => assert.ok(SETS[m].some(b => b.q.some(q => q[0] === id)), `${m}: el dato requerido «${id}» no existe en el cuestionario`)));
});

ok('cada movimiento genera un texto ordenado: título, decisión solicitada y secciones numeradas', () => {
  MOVS.forEach(m => {
    const r = redactar(registro(m));
    assert.ok(r.texto.startsWith('SOLICITUD DE ' + m.toUpperCase()), m);
    assert.ok(/\n1\. DECISIÓN QUE SE SOLICITA\nSe solicita /.test(r.texto), m + ': falta la decisión');
    assert.ok(/\n2\. [A-ZÁÉÍÓÚ ]+\n• /.test(r.texto), m + ': falta la sección 2');
    assert.ok(!/undefined|NaN|\[object/.test(r.texto), m + ': texto con basura');
  });
});

ok('FIDELIDAD: cada respuesta del jefe aparece íntegra en el texto (solo cambia el formato de las fechas)', () => {
  const fmt = s => s.replace(/(\d{4})-(\d{2})-(\d{2})/g, '$3/$2/$1').replace(/\.$/, '');
  MOVS.forEach(m => {
    const reg = registro(m), t = redactar(reg).texto;
    reg.levantamiento.filter(x => x.i !== 'tipoPropuestaNegocio').forEach(x => assert.ok(t.includes(fmt(x.r)), `${m}: se perdió la respuesta de ${x.i}`));   // el tipo de propuesta va dentro del importe (S/ o %)
  });
});

ok('NO INVENTA CIFRAS: todo número del texto sale de un dato del formulario (o es la numeración de secciones)', () => {
  MOVS.forEach(m => {
    const reg = registro(m), t = redactar(reg).texto;
    const permitidos = new Set(JSON.stringify(reg).match(/\d+/g).concat(Array.from({ length: 12 }, (_, k) => String(k + 1)), ['100']));   // numeración de secciones y la escala fija «N/100» del índice
    (t.match(/\d+/g) || []).forEach(x => assert.ok(permitidos.has(x), `${m}: aparece la cifra ${x}, que no está en los datos`));
  });
});

ok('resumen exacto de una promoción (caso de referencia)', () => {
  const r = redactar(registro('Promoción', { levantamiento: [{ i: 'puestoPropuesto', b: 'Cambio propuesto', p: '¿A qué puesto se propone promover?', r: 'Coordinador de Selección' }, { i: 'desdeCuando', b: 'Cambio propuesto', p: '¿Desde cuándo realiza o realizará estas funciones?', r: '2026-11-01' }, { i: 'queCambioPromo', b: 'Qué cambió en el rol', p: 'x', r: 'Asumió la coordinación de dos equipos.' }] }));
  assert.strictEqual(r.resumen, 'Se solicita la promoción de Ana Pérez Soto (0000001234), ANALISTA al puesto de Coordinador de Selección, con funciones desde 01/11/2026. Presupuesto: Sí (Presupuesto aprobado), S/ 4500. Urgencia: Dentro de 30 días. Impacto si no se ejecuta: Alto (retraso operativo).');
  assert.deepStrictEqual(r.alertas, []);
});

ok('PUNTOS A VALIDAR: avisa de lo que falta o no cuadra', () => {
  const base = registro('Encargatura');
  const sinFechas = redactar({ ...base, levantamiento: base.levantamiento.filter(x => !/^fecha(Inicio|Fin)Enc$/.test(x.i)) });
  assert.ok(sinFechas.alertas.includes('Falta fecha de inicio.') && sinFechas.alertas.includes('Falta fecha de fin.'));
  const invertida = redactar({ ...base, levantamiento: base.levantamiento.map(x => x.i === 'fechaFinEnc' ? { ...x, r: '2026-01-01' } : x) });
  assert.ok(invertida.alertas.some(a => /fin de la encargatura es anterior/.test(a)));
  assert.ok(redactar({ ...base, presupuesto: 'Por confirmar' }).alertas.some(a => /presupuesto no está confirmado/.test(a)));
  assert.ok(redactar({ ...base, presupuesto: 'Sí', montoPresupuesto: '' }).alertas.some(a => /no registra el monto/.test(a)));
  assert.ok(redactar({ ...base, aprobaciones: [] }).alertas.some(a => /no registra ninguna/.test(a)));
  assert.ok(redactar({ ...base, aprobaciones: [{ level: 'Presidencia', name: 'X', evidence: 'No' }] }).alertas.some(a => /no tiene evidencia/.test(a)));
  assert.ok(redactar({ ...base, puntaje: '40' }).alertas.some(a => /preparación bajo \(40\/100\)/.test(a)));
  assert.deepStrictEqual(redactar(base).alertas.filter(a => /^Falta/.test(a)), [], 'un registro completo no debe reportar faltantes');
});

ok('incremento salarial: respeta el tipo de propuesta tal como se escribió (monto o porcentaje)', () => {
  const lev = r => registro('Incremento salarial').levantamiento.map(x => x.i === 'tipoPropuestaNegocio' ? { ...x, r } : x);
  assert.ok(/propuesta de S\/ 7\b/.test(redactar(registro('Incremento salarial', { levantamiento: lev('Monto en S/') })).resumen));
  assert.ok(/propuesta de 7%/.test(redactar(registro('Incremento salarial', { levantamiento: lev('Porcentaje %') })).resumen));
});

ok('movimientos sin matrícula (puesto nuevo, reestructuración) no mencionan a una persona', () => {
  ['Puesto nuevo'].forEach(m => {
    const r = redactar(registro(m, { colaborador: 'Vacante nueva', codigo: 'No aplica', puestoActual: 'No aplica' }));
    assert.ok(!/Vacante nueva|No aplica/.test(r.texto), m);
  });
});

ok('registros incompletos o vacíos no rompen el motor', () => {
  assert.doesNotThrow(() => redactar({}));
  assert.doesNotThrow(() => redactar({ movimiento: 'Promoción', levantamiento: [] }));
  assert.ok(/Falta puesto propuesto/.test(redactar({ movimiento: 'Promoción' }).texto));
  assert.ok(redactar({ movimiento: 'Promoción' }, { comentarioBP: 'Revisar fuente de presupuesto' }).texto.includes('OBSERVACIÓN DEL BUSINESS PARTNER\nRevisar fuente de presupuesto'));
});

ok('el texto de una respuesta con código se conserva como texto (no se interpreta)', () => {
  const t = redactar(registro('Otro', { levantamiento: [{ i: 'descripcionOtro', b: 'La solicitud', p: 'x', r: '<img src=x onerror=alert(1)>' }] })).texto;
  assert.ok(t.includes('<img src=x onerror=alert(1)>'));
});
ok('varias posiciones del mismo puesto van en una sola solicitud: el texto lo indica y con una posición no dice nada', () => {
  ['Puesto nuevo'].forEach(m => {
    const con = (n) => { const r = registro(m); r.levantamiento.find(x => x.i === 'cantidadPosiciones').r = n; return redactar(r).texto; };
    assert.ok(/\(3 posiciones\)/.test(con('3')), m); assert.ok(!/posiciones\)/.test(con('1')), m);
  });
});
console.log('\n' + n + ' pruebas del motor OK');

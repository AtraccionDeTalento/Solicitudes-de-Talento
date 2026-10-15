// Revisor de ortografía en español (assets/nspell.min.js + diccionario). Ejecutar: node tests/ortografia.test.js
const assert = require('assert'), fs = require('fs'), vm = require('vm');
const ctx = vm.createContext({}); vm.runInContext(fs.readFileSync('assets/nspell.min.js', 'utf8'), ctx);
const { crear, aplicar } = require('../ortografia.js');
const R = crear(vm.runInContext('nspellLib', ctx), fs.readFileSync('assets/es.aff', 'utf8'), fs.readFileSync('assets/es.dic', 'utf8'));
let n = 0; const ok = (nombre, f) => { f(); n++; console.log('  ✓', nombre); };
const malas = t => R.revisar(t).filter(p => p.tipo === 'ortografia').map(p => p.texto);

ok('encuentra las faltas de la captura y propone la palabra correcta', () => {
  const t = 'Mas repsonsabilidades y mejor comunicaicon, se perderia horas en gestion humana.';
  const r = R.revisar(t).filter(p => p.tipo === 'ortografia');
  const sug = Object.fromEntries(r.map(p => [p.texto, p.sugerencias]));
  assert.ok(sug.repsonsabilidades.includes('responsabilidades'));
  assert.ok(sug.comunicaicon.includes('comunicación'), 'letras cambiadas de lugar + tilde');
  assert.ok(sug.perderia.includes('perdería') && sug.gestion[0] === 'gestión', 'la tilde va primero');
  assert.deepStrictEqual(sug.Mas, ['Más'], '«mas» sin tilde casi siempre es «más»');
  assert.ok(!('mejor' in sug) && !('para' in sug), 'palabras correctas no se marcan');
});
ok('un texto bien escrito, con siglas, nombres, cifras y términos del negocio, no genera avisos', () => {
  const t = 'El HRBP de LIDIA RUFINA GONZALES propone una encargatura de 3 meses para Juan Pérez, con presupuesto aprobado por Finanzas. Se pide la revalorización del puesto.';
  assert.deepStrictEqual(R.revisar(t), []);
});
ok('la mayúscula inicial se respeta en la sugerencia y se avisa si falta', () => {
  assert.deepStrictEqual(R.revisar('Repsonsabilidades nuevas.')[0].sugerencias[0], 'Responsabilidades');
  const m = R.revisar('Se aprueba. el cambio rige hoy.').filter(p => p.tipo === 'mayuscula');
  assert.strictEqual(m.length, 1); assert.strictEqual(m[0].sugerencias[0], 'El');
});
ok('palabras con prefijo (sobreajuste, sobreesfuerzo) son válidas; un error real con prefijo sigue marcándose', () => {
  assert.deepStrictEqual(malas('Hay sobreajuste y sobreesfuerzo en el equipo, por una sobrecarga de trabajo.'), []);
  assert.deepStrictEqual(malas('Hay sobreajustte en el equipo.'), ['sobreajustte']);
});
ok('detecta palabras repetidas y las corrige', () => {
  const t = 'Se solicita el cambio de de puesto para el equipo.';
  assert.strictEqual(aplicar(t, R.revisar(t)), 'Se solicita el cambio de puesto para el equipo.');
});
ok('corregir todo deja el texto limpio, sin mover posiciones ni pisarse', () => {
  const t = 'Mas repsonsabilidades y la administracion de personal. el area crece crece.';
  const fin = aplicar(t, R.revisar(t));
  assert.strictEqual(fin, 'Más responsabilidades y la administración de personal. El área crece.');
  assert.deepStrictEqual(malas(fin), [], fin);
});
ok('aplicar una sugerencia concreta cambia todas las veces que aparece la palabra', () => {
  const t = 'La comunicaicon interna y la comunicaicon externa.', g = R.revisar(t).filter(p => p.texto === 'comunicaicon');
  assert.strictEqual(g.length, 2);
  assert.strictEqual(aplicar(t, g, 'comunicación'), 'La comunicación interna y la comunicación externa.');
});
ok('vacío, solo espacios o símbolos no rompen el revisor', () => {
  ['', '   ', '1234 ... ???', 'ñ', '¡¿!?'].forEach(t => assert.deepStrictEqual(R.revisar(t), []));
});
ok('el vocabulario de Talento, Compensaciones, tecnología y universidad no se marca como error', () => {
  const t = 'La encargatura cubre la subgerencia y la vicepresidencia, con el vicerrectorado y la decanatura. El analista de ciberseguridad y empleabilidad ajusta el workflow, los dashboards, el forecast y el budget; presenta entregables por cuartil, con coaching, mentoring, offboarding y networking con los alumni. Hay escalabilidad, interoperabilidad y proactividad, con ingresantes, sílabos y presencialidad, y ejecución presupuestal revisada por el headcount.';
  assert.deepStrictEqual(malas(t), []);
});
ok('con esas palabras añadidas, los errores de escritura siguen marcándose', () => {
  assert.deepStrictEqual(malas('El analista de ciberseguridd revisa los dashbords y el wokflow.').sort(), ['ciberseguridd', 'dashbords', 'wokflow']);
  assert.deepStrictEqual(malas('La empleabilidd y el vicerrectorao.').sort(), ['empleabilidd', 'vicerrectorao']);
});
console.log('\n' + n + ' pruebas de ortografía OK');

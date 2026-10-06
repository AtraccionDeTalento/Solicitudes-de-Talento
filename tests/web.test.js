// Comprobaciones estáticas de la app web y del panel. Ejecutar: node tests/web.test.js
const fs = require('fs'), path = require('path'), assert = require('assert'), vm = require('vm');
const leer = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const html = leer('index.html'), panel = leer('panel.html'), rules = leer('firestore.rules'), fbjs = leer('firebase.js');
const js = html.slice(html.indexOf('<script>\nconst $') + 8, html.lastIndexOf('</script>'));
let n = 0; const ok = (t, f) => { f(); n++; console.log('  ✓', t); };

ok('el JavaScript de la app compila', () => new vm.Script(js));
ok('el módulo del panel compila', () => {
  const m = /<script type="module">([\s\S]*?)<\/script>/.exec(panel)[1].replace(/^import .*$/m, '');
  new vm.Script('(async()=>{' + m + '})');
});
ok('la CSP solo permite scripts de jsDelivr y gstatic (Firebase)', () => {
  const csp = /Content-Security-Policy" content="([^"]+)"/.exec(html)[1];
  assert.ok(/script-src 'self' 'unsafe-inline' https:\/\/cdn\.jsdelivr\.net https:\/\/www\.gstatic\.com;/.test(csp)); assert.ok(/object-src 'none'/.test(csp));
});
ok('la librería de Excel se carga con verificación de integridad (SRI)', () => assert.ok(/sri:"sha384-/.test(js) && /\.integrity=/.test(js) && /integrity="sha384-/.test(panel)));
ok('no hay datos personales, claves ni URLs de Apps Script en el código', () => {
  assert.ok(!/\b\d{8}\b/.test(html.replace(/0000002458/g, '')), 'número de 8 dígitos (¿DNI?)');
  assert.ok(!/(gmail|hotmail|outlook)\.com/i.test(html + panel + fbjs));
  assert.ok(!/script\.google\.com/.test(html + panel + fbjs), 'quedó una referencia a Apps Script');
});
ok('el ruteo cubre exactamente los 16 departamentos de la app', () => {
  const a = JSON.parse(/const DEPARTAMENTOS=(\[.*?\]);/.exec(js)[1]), b = Object.keys(require('../tools/ruteo'));
  assert.strictEqual(a.length, 16); assert.deepStrictEqual([...a].sort(), [...b].sort());
});
ok('los tipos de movimiento coinciden entre la app y las reglas', () => {
  const a = JSON.parse(/const MOVS=(\[.*?\]);/.exec(js)[1]);
  const b = [...(/d\.movimiento in \[([^\]]+)\]/.exec(rules)[1]).matchAll(/'([^']+)'/g)].map(x => x[1]);
  assert.strictEqual(a.length, 11); assert.deepStrictEqual(a, b);
});
ok('los estados que usa el panel coinciden con las reglas', () => {
  const estados = [...panel.matchAll(/"(Nuevo|En revisión BP|Devuelto al jefe|Enviado a Gerencia|Aprobado|Rechazado|En pausa)"/g)].map(x => x[1]);
  estados.forEach(e => assert.ok(rules.includes("'" + e + "'"), e + ' no está en firestore.rules'));
});
ok('index.html y panel.html cargan el mismo firebase.js', () => assert.ok(/from "\.\/firebase\.js"/.test(html) && /from "\.\/firebase\.js"/.test(panel)));
ok('firebase.js no trae claves de servicio', () => assert.ok(!/private_key|BEGIN PRIVATE/.test(fbjs)));
console.log('\n' + n + ' pruebas OK');

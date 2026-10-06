// Comprobaciones estáticas de la app web y su coherencia con Code.gs. Ejecutar: node tests/web.test.js
const fs = require('fs'), path = require('path'), assert = require('assert'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const gs = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
const js = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
let n = 0; const ok = (t, f) => { f(); n++; console.log('  ✓', t); };

ok('el JavaScript de la app compila', () => new vm.Script(js));
ok('el token de la app coincide con el de Code.gs', () => {
  const a = /token:"([a-f0-9]+)"/.exec(js), b = /TOKEN: "([a-f0-9]+)"/.exec(gs);
  assert.ok(a && b && a[1] === b[1] && a[1].length >= 32);
});
ok('la CSP no permite scripts de orígenes distintos de jsDelivr', () => {
  const csp = /Content-Security-Policy" content="([^"]+)"/.exec(html)[1];
  assert.ok(/script-src 'self' 'unsafe-inline' https:\/\/cdn\.jsdelivr\.net/.test(csp)); assert.ok(/object-src 'none'/.test(csp));
});
ok('la librería de Excel se carga con verificación de integridad (SRI)', () => assert.ok(/sri:"sha384-/.test(js) && /\.integrity=/.test(js)));
ok('no hay datos personales ni el Maestro en el código', () => {
  assert.ok(!/\b\d{8}\b/.test(html.replace(/0000002458/g, '')), 'número de 8 dígitos (¿DNI?)');
  assert.ok(!/(gmail|hotmail|outlook)\.com/i.test(html + gs));
});
ok('los 16 departamentos de la app y de Code.gs coinciden', () => {
  const a = JSON.parse(/const DEPARTAMENTOS=(\[.*?\]);/.exec(js)[1]);
  const m = /"departamentos": (\[[\s\S]*?\])\n}/.exec(gs) || /"departamentos": (\[[\s\S]*?\])/.exec(gs);
  const b = JSON.parse(m[1]); assert.strictEqual(a.length, 16); assert.deepStrictEqual([...a].sort(), [...b].sort());
});
ok('los tipos de movimiento coinciden entre la app y Code.gs', () => {
  const a = JSON.parse(/const MOVS=(\[.*?\]);/.exec(js)[1]);
  const b = [...gs.matchAll(/"nombre": "([^"]+)",\n\s+"descripcion"/g)].map(x => x[1]);
  assert.strictEqual(a.length, 11); assert.deepStrictEqual(a, b);
});
ok('panel.html (GitHub Pages) es copia de apps-script/Panel.html', () => assert.strictEqual(fs.readFileSync(path.join(__dirname, '..', 'panel.html'), 'utf8'), fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Panel.html'), 'utf8')));
console.log('\n' + n + ' pruebas OK');

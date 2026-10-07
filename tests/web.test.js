// Comprobaciones estáticas de la app, el panel y del contenido del repositorio. Ejecutar: node tests/web.test.js
const fs = require('fs'), path = require('path'), assert = require('assert'), vm = require('vm'), { execSync } = require('child_process');
const raiz = path.join(__dirname, '..');
const leer = f => fs.readFileSync(path.join(raiz, f), 'utf8');
const html = leer('index.html'), panelHtml = leer('panel.html'), rules = leer('firestore.rules'), fbjs = leer('firebase.js');
const js = leer('app.js'), panel = leer('panel.js');   // los scripts van en archivos propios: la CSP no permite scripts inline
let n = 0; const ok = (t, f) => { f(); n++; console.log('  ✓', t); };
const versionados = () => execSync('git ls-files', { cwd: raiz }).toString().split('\n').filter(Boolean).filter(f => fs.existsSync(path.join(raiz, f)));
const csp = h => /Content-Security-Policy" content="([^"]+)"/.exec(h)[1];

ok('el JavaScript de la app y del panel compila', () => {
  new vm.Script(js);
  new vm.Script('(async()=>{' + panel.replace(/^import .*$/m, '') + '})');
});
ok('la CSP de ambas páginas no permite scripts inline ni orígenes ajenos', () => {
  [html, panelHtml].forEach(h => {
    const c = csp(h), script = /script-src ([^;]+)/.exec(c)[1];
    assert.ok(!/unsafe-inline|unsafe-eval|\*\s|http:/.test(script), script);
    assert.ok(/object-src 'none'/.test(c) && /base-uri 'none'/.test(c) && !/connect-src[^;]*http:/.test(c));
    assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(h), 'hay un <script> inline');
    assert.ok(!/\son(click|error|submit|load|change|input)\s*=/i.test(h), 'hay un manejador inline');
  });
});
ok('las librerías de Excel se cargan con verificación de integridad (SRI)', () => assert.ok(/sri:"sha384-/.test(js) && /\.integrity=/.test(js) && /integrity="sha384-/.test(panelHtml)));
ok('index.html y panel.html cargan el mismo firebase.js', () => assert.ok(/from "\.\/firebase\.js"/.test(leer('fb-init.js')) && /from "\.\/firebase\.js"/.test(panel)));
ok('no hay Apps Script, claves ni tokens en el código', () => {
  const todo = [html, panelHtml, js, panel, fbjs].join('\n');
  assert.ok(!/script\.google\.com|PRIVATE KEY|private_key|[a-f0-9]{40,}/.test(todo));
});
ok('el repositorio no contiene correos ni nombres de personas reales', () => {
  const permitidos = /^(usuario|nombre|hrbp\d?|bp\d|ger\d|jefe\d?|otro|otra|x|z)$/;
  versionados().filter(f => /\.(js|html|rules|md|txt|py|json)$/.test(f) && !/package-lock/.test(f) && f !== 'tests/web.test.js').forEach(f => {
    for (const m of leer(f).matchAll(/([A-Za-z0-9._-]+)@(usil\.edu\.pe|[a-z0-9.-]+\.[a-z]{2,})/g))
      assert.ok(permitidos.test(m[1]) || m[2] === 'gmail.com', f + ': ' + m[0]);
  });
});
ok('no hay planillas, CSV ni claves de servicio versionados', () => {
  const malos = versionados().filter(f => /\.(xlsx|xls|csv)$/.test(f) || /(adminsdk|service-?account|usuarios\.json|ruteo\.local)/i.test(f));
  assert.deepStrictEqual(malos, []);
});
ok('no hay matrículas ni números de 8+ dígitos en el código', () => {
  assert.ok(!/\b\d{8,}\b/.test(html.replace(/0000001234/g, '') + js.replace(/0000001234|0000012345|\b1\d{12}\b/g, '')), 'número largo (¿DNI o matrícula?)');
});
ok('los 16 departamentos de la app y del ruteo coinciden', () => {
  const a = JSON.parse(/const DEPARTAMENTOS=(\[.*?\]);/.exec(js)[1]), b = require('../tools/departamentos');
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
ok('las reglas exigen Google institucional verificado y no admiten anónimos', () => {
  assert.ok(/email_verified == true/.test(rules) && /sign_in_provider == 'google\.com'/.test(rules) && /usil\[\.\]edu\[\.\]pe/.test(rules));
  assert.ok(!/anonymous/.test(rules + fbjs));
});
ok('Vercel: las cabeceras repiten la CSP de las páginas, sin frame, y publican solo el sitio', () => {
  const v = JSON.parse(leer('vercel.json')).headers[0].headers, h = k => (v.find(x => x.key === k) || {}).value;
  assert.strictEqual(h('Content-Security-Policy'), csp(html) + "; frame-ancestors 'none'"); assert.strictEqual(csp(html), csp(panelHtml));
  assert.ok(/max-age=\d{8,}/.test(h('Strict-Transport-Security')) && h('X-Content-Type-Options') === 'nosniff' && h('X-Frame-Options') === 'DENY');
  assert.ok(/same-origin-allow-popups/.test(h('Cross-Origin-Opener-Policy')), 'COOP debe permitir el popup de Google');
  const ign = leer('.vercelignore').split('\n'); ['tools', 'tests', 'docs', 'firestore.rules', 'package.json'].forEach(x => assert.ok(ign.includes(x), x));
});
console.log('\n' + n + ' pruebas OK');

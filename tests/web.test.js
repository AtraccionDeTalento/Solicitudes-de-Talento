// Comprobaciones estáticas de la app, el panel y del contenido del repositorio. Ejecutar: node tests/web.test.js
const fs = require('fs'), path = require('path'), assert = require('assert'), vm = require('vm'), { execSync } = require('child_process');
const raiz = path.join(__dirname, '..');
const leer = f => fs.readFileSync(path.join(raiz, f), 'utf8').replace(/\r\n/g, '\n');   // Git en Windows puede dejar CRLF
const html = leer('index.html'), panelHtml = leer('panel.html'), rules = leer('firestore.rules'), fbjs = leer('firebase.js');
const js = leer('app.js'), panel = leer('panel.js');   // los scripts van en archivos propios: la CSP no permite scripts inline
let n = 0; const ok = (t, f) => { f(); n++; console.log('  ✓', t); };
const versionados = () => execSync('git ls-files', { cwd: raiz }).toString().split('\n').filter(Boolean).filter(f => fs.existsSync(path.join(raiz, f)));
const csp = h => /Content-Security-Policy" content="([^"]+)"/.exec(h)[1];

ok('el JavaScript de la app y del panel compila', () => {
  new vm.Script(js);
  new vm.Script('(async()=>{' + panel.replace(/^import .*$/gm, '') + '})');
});
ok('la CSP de ambas páginas no permite scripts inline ni orígenes ajenos', () => {
  [html, panelHtml].forEach(h => {
    const c = csp(h), script = /script-src ([^;]+)/.exec(c)[1];
    assert.ok(!/unsafe-inline|unsafe-eval|\*\s|http:/.test(script), script);
    script.split(' ').filter(x => /^https:/.test(x)).forEach(x => assert.ok(/^https:\/\/[^/]+\/.+/.test(x), 'script-src sin ruta exacta (permitiría cualquier paquete del CDN): ' + x));
    assert.ok(/object-src 'none'/.test(c) && /base-uri 'none'/.test(c) && !/connect-src[^;]*http:/.test(c));
    assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(h), 'hay un <script> inline');
    assert.ok(!/\son(click|error|submit|load|change|input)\s*=/i.test(h), 'hay un manejador inline');
  });
});
ok('cada aprobación exige su captura: se comprime en el navegador, no se guarda en el borrador y se envía en un lote con la solicitud', () => {
  assert.ok(/async function comprimirImagen/.test(js) && /createImageBitmap/.test(js) && /image\/jpeg/.test(js) && /MAX_CAPTURA=400000/.test(js));
  assert.ok(/classList\.contains\("ap-file"\)\) return true/.test(js) && /el\.type==="file"\)/.test(js), 'la captura debe ser obligatoria');
  assert.ok(!/ap-file[^\n]*(store|localStorage|sessionStorage)/.test(js), 'la captura no va al borrador');
  assert.ok(/writeBatch/.test(fbjs) && /evidencias/.test(fbjs) && /evidencias/.test(panel) && /evidencias/.test(rules));
  assert.ok(!/innerHTML[^\n]*evid-img|evid-img[^\n]*innerHTML/.test(panel), 'las capturas se pintan con DOM, no con innerHTML');
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
  assert.strictEqual(a.length, 7); assert.deepStrictEqual(a, b);
});
ok('los estados que usa el panel coinciden con las reglas', () => {
  const estados = [...panel.matchAll(/"(Nuevo|En revisión BP|Devuelto al jefe|Enviado a Gerencia|Aprobado|Rechazado|En pausa)"/g)].map(x => x[1]);
  estados.forEach(e => assert.ok(rules.includes("'" + e + "'"), e + ' no está en firestore.rules'));
});
ok('las reglas: el jefe (sesión anónima) solo crea y lee lo suyo; el Maestro se cierra a jefes sin verificar en producción; sin Google', () => {
  assert.ok(!/google\.com/.test(rules + fbjs));
  assert.ok(/function anonimo\(\)[^}]*== 'anonymous'/.test(rules) && /function prueba\(\)[^}]*modoPrueba == true/.test(rules));
  assert.ok(/allow get: if staff\(\) \|\| \(\(personal\(\) \|\| anonimoOk\(\)\) && prueba\(\)\)/.test(rules), 'el Maestro solo lo lee el personal con rol; un jefe anónimo solo en modo prueba');
  assert.ok(/function anonimoOk\(\)[^}]*accesoAnonimo/.test(rules), 'el acceso anónimo debe depender de config/app.accesoAnonimo');
  assert.ok(/allow create: if \(\(personal\(\) && request\.resource\.data\.enviadoPor == yo\(\)\)/.test(rules), 'el jefe con clave solo crea a su nombre');
  assert.ok(/match \/bps\/\{id\}\s+\{ allow get, list: if staff\(\)/.test(rules), 'los nombres de socios de negocio no son para jefes');
  assert.ok(/function personal\(\)[^}]*email_verified|function usil\(\)[^}]*email_verified == true/.test(rules), 'HRBP y Gerencia exigen correo verificado');
});
ok('la pantalla de entrada: correo institucional y clave (sin Google); Socio de negocio y Gerencia por un botón aparte', () => {
  const login = /<div id="login"[\s\S]*?<\/form>/.exec(html)[0];
  assert.deepStrictEqual([...login.matchAll(/<input id="(\w+)"/g)].map(m => m[1]), ['lgMail', 'lgPass']);
  assert.ok(!/google/i.test(login) && !/GoogleAuthProvider|signInWithPopup|entrarGoogle/.test(js + panel + fbjs));
  assert.ok(/id="lgPanel"/.test(login) && /lgPanel"\)\.onclick=\(\)=>\{location\.href=CONFIG\.panelUrl\}/.test(js));
});
ok('Vercel: las cabeceras repiten la CSP de las páginas, sin frame, y publican solo el sitio', () => {
  const v = JSON.parse(leer('vercel.json')).headers[0].headers, h = k => (v.find(x => x.key === k) || {}).value;
  assert.strictEqual(h('Content-Security-Policy'), csp(html) + "; frame-ancestors 'none'"); assert.strictEqual(csp(html), csp(panelHtml));
  assert.ok(/max-age=\d{8,}/.test(h('Strict-Transport-Security')) && h('X-Content-Type-Options') === 'nosniff' && h('X-Frame-Options') === 'DENY');
  assert.strictEqual(h('Cross-Origin-Opener-Policy'), 'same-origin');
  const ign = leer('.vercelignore').split('\n'); ['tools', 'tests', 'docs', 'firestore.rules', 'package.json'].forEach(x => assert.ok(ign.includes(x), x));
});
ok('la validación de correo usa expresiones correctas (acepta correos con «s»)', () => {
  const m = /const esUsil = email => (\/[^\n]+?\/i)\.test\(email\);/.exec(fbjs);
  assert.ok(m, 'no se encontró la validación'); const re = vm.runInNewContext(m[1]);
  assert.ok(re.test('susana.sosa@usil.edu.pe') && !re.test('x@gmail.com') && !re.test('a b@usil.edu.pe') && !re.test('x@usilXeduYpe'));
  assert.ok(['x@usil.pe','x@epg.usil.pe','x@sir.pe','x@sir.edu.pe','x@institutoemprendedores.pe'].every(x => re.test(x)) && !['x@usil.pe.evil.com','x@evilusil.pe','x@hotmail.com'].some(x => re.test(x)), 'dominios de las unidades');
  assert.ok(!/replace\(\/s\+\//.test(js + fbjs), 'falta la barra en /\\s+/');
});
ok('la base acepta solo los campos de la app, con tope en los textos libres y en las listas', () => {
  assert.ok(/d\.keys\(\)\.hasOnly\(\[/.test(rules) && /d\.keys\(\)\.hasAll\(\[/.test(rules));
  ['impactoDetalle', 'solicitudConcreta', 'fortalezas', 'alertas', 'cliente'].forEach(k => assert.ok(new RegExp("s\\(d, '" + k + "', \\d+\\)").test(rules), 'sin tope: ' + k));
  assert.ok(/levantamiento[^\n]*size\(\) <= \d+/.test(rules) && /aprobaciones[^\n]*size\(\) <= 3/.test(rules));
  assert.ok((rules.match(/s\(d, '/g) || []).length <= 30, 'demasiadas comprobaciones: Firestore corta las reglas a 1000 expresiones (la prueba de la solicitud completa lo vigila)');
});
ok('nada de datos personales queda en el navegador tras cerrar la pestaña, y el panel cierra la sesión por inactividad', () => {
  assert.ok(!/localStorage/.test(js + panel + fbjs), 'localStorage deja datos de colaboradores en equipos compartidos');
  assert.ok(/browserSessionPersistence/.test(panel) && /INACTIVO_MIN\s*=\s*\d+/.test(panel) && /signOut\(FB\.auth\)/.test(panel));
});
ok('cabeceras: sin indexar, sin caché y mismo origen; Vercel no publica .github ni la configuración', () => {
  const v = JSON.parse(leer('vercel.json')).headers[0].headers, h = k => (v.find(x => x.key === k) || {}).value;
  assert.ok(/noindex/.test(h('X-Robots-Tag')) && h('Cache-Control') === 'no-store' && h('Cross-Origin-Resource-Policy') === 'same-origin');
  const ign = leer('.vercelignore').split('\n'); ['.github', 'vercel.json'].forEach(x => assert.ok(ign.includes(x), x));
  assert.ok(/permissions:\s*\n\s+contents: read/.test(leer('.github/workflows/ci.yml')), 'la integración continua debe tener permisos mínimos');
});
ok('los datos que escribe un jefe y ve el personal siempre pasan por esc(): ninguna plantilla inserta campos sin escapar', () => {
  const crudo = [...panel.matchAll(/\$\{(f|d|a|x|q|par)\.[a-zA-Z]+\}/g)].map(m => m[0]);
  assert.deepStrictEqual(crudo, [], 'interpolación sin esc(): ' + crudo.join(', '));
});

ok('el hosting no publica .git, .github, tools, tests, docs ni la configuración (una carpeta .git publicada expone todo el historial)', () => {
  const ign = (JSON.parse(leer('firebase.json')).hosting || { ignore: ['.git/**', '**/.git/**', '.github/**', 'tools/**', 'tests/**', 'docs/**', 'firestore.rules'] }).ignore;
  ['.git/**', '**/.git/**', '.github/**', 'tools/**', 'tests/**', 'docs/**', 'firestore.rules'].forEach(x => assert.ok(ign.includes(x), 'firebase.json no ignora ' + x));
  assert.ok(leer('.vercelignore').split('\n').includes('.git'), '.vercelignore debe excluir .git');
});

ok('cada Business Partner crea su cuenta con su correo y su clave; el correo se confirma y las reglas exigen un rol autorizado', () => {
  assert.ok(/panelCrear/.test(panel) && /sendEmailVerification/.test(panel));
  assert.ok(!/panelOlvide|sendPasswordResetEmail|olvideClave/.test(panel + leer('firebase.js')), 'la recuperación de clave por correo se eliminó: las claves las restablece el administrador');
  assert.ok(/emailVerified/.test(panel) && /Falta confirmar tu correo/.test(panel), 'sin confirmar el correo no se entra');
  assert.ok(/String\(clave\)\.length<12/.test(panel), 'la clave elegida debe tener 12+ caracteres');
  assert.ok(/email_verified == true/.test(rules) && /exists\([^\n]*roles/.test(rules), 'las reglas exigen correo verificado y un rol autorizado');
});

ok('el colaborador se busca por correo (autorrelleno) y los Business Partner pueden derivarse solicitudes entre sí', () => {
  assert.ok(/id="correoColab"/.test(js) && /lookupEmployeeByEmail/.test(js) && /postMaestro\(\{correo:mail\}\)/.test(js), 'falta la búsqueda por correo');
  assert.ok(/extra\.correo/.test(fbjs) && /colaboradores/.test(fbjs));
  assert.ok(/match \/colaboradores\/\{correo\}/.test(rules) && /busquedaJefes/.test(rules), 'la búsqueda por correo debe tener reglas propias');
  assert.ok(/Derivar a otro socio/.test(panel) && /derivarA/.test(panel) && /function derivacion\(\)/.test(rules));
});

console.log('\n' + n + ' pruebas OK');

// Pruebas del Apps Script (Code.gs) con una simulación en memoria de los servicios de Google.
// Ejecutar:  node tests/apps-script.test.js
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const code = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');

// ---------- simulación mínima de Google ----------
const items = [], mails = [], files = [];
class Item {
  constructor(k) { this.kind = k; this.o = {}; }
  setTitle(t) { this.o.title = t; return this; } setHelpText(t) { this.o.help = t; return this; }
  setRequired(b) { this.o.req = b; return this; } setValidation(v) { this.o.val = v; return this; }
  setChoiceValues(v) { this.o.choices = v.map(x => ({ value: x })); return this; } setChoices(c) { this.o.choices = c; return this; }
  createChoice(v, nav) { return { value: v, nav }; } setGoToPage(p) { this.o.goTo = p; return this; }
}
const mk = k => { const i = new Item(k); items.push(i); return i; };
const vb = () => { const b = { rules: [] }; ['requireTextMatchesPattern', 'requireTextLengthGreaterThanOrEqualTo', 'requireNumberGreaterThan', 'requireNumberGreaterThanOrEqualTo'].forEach(m => b[m] = x => { b.rules.push([m, x]); return b; }); b.setHelpText = t => { b.help = t; return b; }; b.build = () => b; return b; };
const form = { getId: () => 'FID', getPublishedUrl: () => 'pub', getEditUrl: () => 'edit', addTextItem: () => mk('text'), addParagraphTextItem: () => mk('para'), addListItem: () => mk('list'), addDateItem: () => mk('date'), addPageBreakItem: () => mk('page'), addCheckboxItem: () => mk('check'), getResponses: () => [] };
['setDescription', 'setCollectEmail', 'setAllowResponseEdits', 'setProgressBar', 'setShowLinkToRespondAgain', 'setConfirmationMessage', 'setRequireLogin', 'setLimitOneResponsePerUser'].forEach(n => form[n] = () => form);
class Sheet {
  constructor(n) { this.n = n; this.rows = []; }
  setName(n) { this.n = n; return this; } clear() { this.rows = []; } getMaxRows() { return 1000; } setFrozenRows() {} setFrozenColumns() {} setColumnWidth() {}
  appendRow(r) { this.rows.push(r.slice()); } getDataRange() { const s = this; return { getValues: () => s.rows.map(r => r.slice()) }; }
  createTextFinder(t) { const s = this; return { matchEntireCell() { return this; }, matchCase() { return this; }, findNext() { for (let i = 0; i < s.rows.length; i++) for (let j = 0; j < s.rows[i].length; j++) if (String(s.rows[i][j]) === t) return { getRow: () => i + 1, getColumn: () => j + 1 }; return null; } }; }
  getRange(a, b, c, d) {
    const s = this; if (typeof a === 'string') return { setValue() { return this; }, getValues() { return []; } };
    const g = { setNumberFormat() { return g; }, setFontWeight() { return g; }, setBackground() { return g; }, setFontColor() { return g; }, createFilter() {}, setDataValidation() { return g; }, setFormula() {}, setFormulas() { return g; }, setValue(v) { s.rows[a - 1][b - 1] = v; return g; },
      setValues(v) { v.forEach((row, i) => { s.rows[a - 1 + i] = s.rows[a - 1 + i] || []; row.forEach((x, j) => s.rows[a - 1 + i][b - 1 + j] = x); }); return g; },
      getValues() { return s.rows.slice(a - 1, a - 1 + (c || 1)).map(r => (r || []).slice(b - 1, b - 1 + (d || 1))); } };
    return g;
  }
}
const sheets = {};
const ss = { getActiveSheet: () => sheets.A || (sheets.A = new Sheet('A')), getId: () => 'SID', getUrl: () => 'SSURL', insertSheet: n => sheets[n] = new Sheet(n),
  getSheetByName: n => Object.values(sheets).find(s => s.n === n) || null, addEditors: l => { ss.editors = l; } };
const props = {}, cacheStore = {};
const ctx = {
  FormApp: { create: () => form, createTextValidation: vb, createParagraphTextValidation: vb },
  SpreadsheetApp: { create: () => ss, openById: () => ss, newDataValidation: () => ({ requireValueInList() { return this; }, requireValueInRange() { return this; }, setAllowInvalid() { return this; }, build() {} }) },
  PropertiesService: { getScriptProperties: () => ({ setProperty: (k, v) => props[k] = v, getProperty: k => props[k], deleteProperty: k => { delete props[k]; } }) },
  CacheService: { getScriptCache: () => ({ get: k => cacheStore[k] || null, put: (k, v) => { cacheStore[k] = v; }, remove: k => { delete cacheStore[k]; } }) },
  ScriptApp: { newTrigger: () => ({ forForm: () => ({ onFormSubmit: () => ({ create() {} }) }) }) }, Logger: { log() {} },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Utilities: { getUuid: () => Math.random().toString(36).slice(2) + Date.now().toString(36), formatDate: (d, tz, f) => { const z = x => String(x).padStart(2, '0'), iso = d.toISOString(); const [Y, M, D, H] = [iso.slice(0, 4), iso.slice(5, 7), iso.slice(8, 10), iso.slice(11, 13)];
    return f === 'yyMMdd' ? Y.slice(2) + M + D : f === 'yyyyMMddHH' ? Y + M + D + H : f === 'yyyyMMdd' ? Y + M + D : Y + '-' + M + '-' + D + '_' + H + '00'; } },
  Session: { getScriptTimeZone: () => 'UTC', getActiveUser: () => ({ getEmail: () => ctx.quien }) }, HtmlService: { createHtmlOutputFromFile: f => ({ f, setTitle() { return this; }, addMetaTag() { return this; } }) }, MailApp: { sendEmail: m => mails.push(m.to ? m : { to: m }) },
  ContentService: { createTextOutput: t => ({ t, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
  DriveApp: { getFoldersByName: () => ({ hasNext: () => false }), createFolder: () => ({ createFile: (n, c) => { files.push({ n, c }); return { getUrl: () => n }; } }) }, console
};
vm.createContext(ctx);
vm.runInContext(code + ';this.F={crearFormulario,alEnviar,doPost,exportarEntradas,compartirConBPs,doGet,panelDatos,panelDetalle,panelActualizar,panelEntrar,panelQuien,panelExportar,cargarRuteoDePrueba,CONFIG,CATALOGO};', ctx);
const F = ctx.F;
let n = 0; const ok = (nombre, fn) => { fn(); n++; console.log('  ✓', nombre); };

console.log('Formulario');
F.crearFormulario();
const pages = items.filter(i => i.kind === 'page');
ok('estructura: 11 movimientos, páginas y preguntas', () => { assert.strictEqual(F.CATALOGO.movs.length, 11); assert.ok(pages.length >= 59); assert.ok(items.length > 250); });
ok('todas las preguntas obligatorias y con título', () => items.filter(i => i.kind !== 'page').forEach(i => { assert.ok(i.o.req, i.o.title); assert.ok(i.o.title); }));
ok('toda navegación apunta a una sección existente', () => items.forEach(i => { (i.o.choices || []).forEach(c => c.nav && assert.ok(pages.includes(c.nav))); i.o.goTo && assert.ok(pages.includes(i.o.goTo)); }));
const movItem = items.find(i => i.o.title === 'Tipo de movimiento');
ok('cada movimiento llega a Aprobaciones y termina en Confirmación', () => F.CATALOGO.movs.forEach(m => {
  let p = movItem.o.choices.find(c => c.value === m.nombre).nav, vis = [];
  for (let g = 0; g < 80 && p; g++) { vis.push(p.o.title); let nx = null; for (let j = items.indexOf(p) + 1; j < items.length; j++) if (items[j].kind === 'page') { nx = items[j]; break; } p = p.o.goTo || nx; }
  assert.ok(vis.includes('Aprobaciones previas'), m.nombre); assert.strictEqual(vis[vis.length - 1], 'Confirmación', m.nombre);
}));
ok('Encargatura ramifica por tipo', () => { const t = items.find(i => i.o.title === 'Tipo de encargatura'); assert.strictEqual(t.o.choices.length, 3); assert.ok(t.o.choices.every(c => c.nav)); });
ok('el departamento es una lista de 16 (no hay campo BP)', () => { assert.strictEqual(F.CATALOGO.departamentos.length, 16); assert.ok(!items.some(i => i.o.title === 'Business Partner responsable')); });

console.log('Ruteo y formulario');
F.CONFIG.COORDINADOR = 'coord@usil.edu.pe';
const ruteo = ss.getSheetByName('Ruteo');
ruteo.rows[1] = ['VICERRECTORADO ACADEMICO', '*', 'Ana BP', 'ana.bp@usil.edu.pe'];
ruteo.rows.push(['Vicerrectorado Académico', 'Facultad de Ingeniería', 'Beto BP', 'beto.bp@usil.edu.pe']);
const resp = (R, mail) => ({ getItemResponses: () => Object.entries(R).map(([t, v]) => ({ getItem: () => ({ getTitle: () => t }), getResponse: () => v })), getRespondentEmail: () => mail, getTimestamp: () => new Date('2026-10-05T10:00:00Z'), getId: () => 'resp123456' + Math.random().toString(36).slice(2, 12), getEditResponseUrl: () => 'EDITURL' });
const base = (dep, area) => ({ 'Fecha de solicitud': '2026-10-05', 'Nombre del líder solicitante': 'Ana Perez', 'Cargo del líder': 'Director', 'Tipo de movimiento': 'Reemplazo', 'Matrícula del colaborador (4 a 10 dígitos)': '2458', 'Nombre y apellido del colaborador': 'Lucia Ramos', 'Puesto actual': 'Analista', 'Departamento': dep, 'Área': area, 'Sección': 'G', '¿Qué posición requiere ser reemplazada?': 'Jefe', '¿Cuenta con alguna aprobación previa?': 'No', '¿Cuenta con presupuesto?': 'Sí', 'Fuente de presupuesto': 'Presupuesto aprobado', 'Quién confirma o valida el presupuesto': 'Plan', 'Monto disponible en S/ (escribe 0 si no hay)': '900', '¿Cuándo se necesita implementar?': 'Inmediato', 'Nivel de impacto si no se ejecuta': 'Alto', 'Principal consecuencia de no aprobar': 'Retraso operativo', 'Explique brevemente el impacto': 'x' });
F.alEnviar({ response: resp(base('VICERRECTORADO ACADEMICO', 'Facultad de Ingeniería'), 'jefe1@usil.edu.pe') });
F.alEnviar({ response: resp(base('VICERRECTORADO ACADEMICO', 'Otra área'), 'jefe2@usil.edu.pe') });
F.alEnviar({ response: resp(base('RECTORADO', 'X'), 'jefe3@usil.edu.pe') });
const ent = ss.getSheetByName('Entradas'), iBP = 15;
ok('área específica → BP específico; área general → BP general; sin BP → "Sin asignar"', () => assert.deepStrictEqual(ent.rows.slice(1).map(r => r[iBP]), ['Beto BP', 'Ana BP', 'Sin asignar']));
ok('matrícula guardada con 10 dígitos', () => assert.strictEqual(ent.rows[1][9], '0000002458'));
ok('correos al BP, al jefe y (si no hay BP) al coordinador', () => { const to = mails.map(m => m.to); ['beto.bp@usil.edu.pe', 'jefe1@usil.edu.pe', 'ana.bp@usil.edu.pe', 'coord@usil.edu.pe'].forEach(x => assert.ok(to.includes(x), x)); });

console.log('App web (doPost)');
const web = () => ({ id: 'CASE-1', data: { fechaSolicitud: '2026-10-05', cliente: 'Mario Lopez', cargoCliente: 'Jefe', emailCliente: 'mario@usil.edu.pe', departamento: 'GERENCIA LEGAL', area: 'Contratos', seccion: 'S', codigo: 'No aplica', colaborador: 'x', puestoActual: 'x', movimiento: 'Puesto nuevo', tieneAprobacion: 'No', presupuesto: 'Sí', fuentePresupuesto: 'Ahorro interno', validaPresupuesto: 'Fin', montoPresupuesto: '500', urgencia: 'Inmediato', impacto: 'Alto', consecuencia: 'Otro', impactoDetalle: 'y', solicitudConcreta: 'Sustento', dynamic: { puestoNuevo: 'Analista Legal', inventado: 'x' }, approvals: [] } });
ruteo.rows.push(['GERENCIA LEGAL', '*', 'Carla BP', 'carla.bp@usil.edu.pe']);
const TOKEN = F.CONFIG.TOKEN, post = b => JSON.parse(F.doPost({ postData: { contents: JSON.stringify(b), length: JSON.stringify(b).length } }).t);
ok('hay un TOKEN configurado', () => assert.ok(TOKEN && TOKEN.length >= 32));
ok('rechaza sin token', () => assert.strictEqual(post({ rec: web() }).error, 'No autorizado'));
ok('acepta una solicitud válida y la asigna al BP', () => { const r = post({ token: TOKEN, rec: web() }); assert.ok(r.ok); assert.strictEqual(r.bp, 'Carla BP'); });
ok('reenviar el mismo ID actualiza (no duplica) y filtra campos inventados', () => { const antes = ent.rows.length; const w = web(); w.data.impactoDetalle = 'editado'; assert.ok(post({ token: TOKEN, rec: w }).ok); assert.strictEqual(ent.rows.length, antes); assert.ok(!JSON.stringify(ent.rows.find(r => r[0] === 'CASE-1')).includes('inventado')); });
ok('rechaza correos fuera de @usil.edu.pe', () => { const w = web(); w.id = 'X1'; w.data.emailCliente = 'alguien@gmail.com'; assert.strictEqual(post({ token: TOKEN, rec: w }).error, 'Usa tu correo institucional'); });
ok('rechaza departamento, movimiento, fecha y matrícula inválidos', () => {
  const w1 = web(); w1.id = 'X2'; w1.data.departamento = 'INVENTADO'; assert.strictEqual(post({ token: TOKEN, rec: w1 }).error, 'Departamento inválido');
  const w2 = web(); w2.id = 'X3'; w2.data.movimiento = 'Nada'; assert.strictEqual(post({ token: TOKEN, rec: w2 }).error, 'Tipo de movimiento inválido');
  const w3 = web(); w3.id = 'X4'; w3.data.fechaSolicitud = '05/10/2026'; assert.strictEqual(post({ token: TOKEN, rec: w3 }).error, 'Fecha de solicitud inválida');
  const w4 = web(); w4.id = 'X5'; w4.data.movimiento = 'Promoción'; w4.data.codigo = 'ABC'; assert.strictEqual(post({ token: TOKEN, rec: w4 }).error, 'Matrícula inválida');
});
ok('otro usuario no puede pisar una solicitud ajena', () => { const w = web(); w.data.emailCliente = 'intruso@usil.edu.pe'; assert.strictEqual(post({ token: TOKEN, rec: w }).error, 'ID ya registrado por otro usuario'); });
ok('limpia caracteres de control y no deja saltos en el asunto del correo', () => { const w = web(); w.id = 'X6'; w.data.cliente = 'Ana\u0000\u0007 Perez'; w.data.colaborador = 'x'; w.data.area = 'Con\r\ntratos'; assert.ok(post({ token: TOKEN, rec: w }).ok); const fila = ent.rows.find(r => r[0] === 'X6'); assert.ok(!/[\u0000\u0007]/.test(fila[7])); assert.ok(mails.filter(m => /X6/.test(m.subject || '')).every(m => !/[\r\n]/.test(m.subject))); });
ok('rechaza solicitudes demasiado grandes', () => assert.ok(/demasiado grande/.test(JSON.parse(F.doPost({ postData: { contents: '{}', length: 999999 } }).t).error)));
ok('límite por correo y hora (anti-spam)', () => { let ultimo; for (let i = 0; i < F.CONFIG.MAX_POR_CORREO_HORA + 2; i++) { const w = web(); w.id = 'R' + i; w.data.emailCliente = 'spam@usil.edu.pe'; ultimo = post({ token: TOKEN, rec: w }); } assert.ok(/Demasiados envíos/.test(ultimo.error)); });
ok('límite global por día', () => { F.CONFIG.MAX_GLOBAL_DIA = 1; const w = web(); w.id = 'G1'; w.data.emailCliente = 'otro@usil.edu.pe'; const r = post({ token: TOKEN, rec: w }); assert.ok(/límite diario/.test(r.error), JSON.stringify(r)); F.CONFIG.MAX_GLOBAL_DIA = 300; });

console.log('Exportación');
ok('exporta JSON y CSV con ambos orígenes', () => { const r = F.exportarEntradas(); const j = JSON.parse(files.find(f => f.n.endsWith('.json')).c); assert.strictEqual(r.total, j.length); assert.ok(j.some(e => e.origen === 'formulario') && j.some(e => e.origen === 'web')); assert.ok(j.every(e => e.data && 'dynamic' in e.data && 'approvals' in e.data)); assert.ok(files.find(f => f.n.endsWith('.csv')).c.startsWith('﻿')); });
ok('compartirConBPs incluye BP y coordinador', () => { F.compartirConBPs(); ['ana.bp@usil.edu.pe', 'carla.bp@usil.edu.pe', 'coord@usil.edu.pe'].forEach(x => assert.ok(ss.editors.includes(x), x)); });
console.log('Panel (jefe · BP · gerencia)');
F.CONFIG.GERENTES = ['karla@usil.edu.pe'];
ss.getSheetByName('BPs').rows.push(['Beto BP', 'beto.bp@usil.edu.pe', 'Socio de Negocio']);
const como = (mail, fn) => { ctx.quien = mail; return fn(); };
const falla = (fn, re) => assert.throws(fn, re);
ok('doGet sirve Panel.html y el archivo existe', () => { assert.strictEqual(F.doGet().f, 'Panel'); assert.ok(fs.existsSync(path.join(__dirname, '..', 'apps-script', 'Panel.html'))); });
ok('sin sesión de Google o con otro dominio: sin acceso', () => { falla(() => como('', () => F.panelDatos('jefe')), /Inicia sesión/); falla(() => como('x@gmail.com', () => F.panelDatos('jefe')), /institucional/); });
ok('jefe ve solo lo suyo y no entra a BP ni Gerencia', () => {
  const d = como('jefe1@usil.edu.pe', () => F.panelDatos('jefe')); assert.strictEqual(d.vistas.join(), 'jefe'); assert.ok(d.filas.length >= 1 && d.filas.every(f => f.enviadoPor === 'jefe1@usil.edu.pe'));
  assert.ok(!('_dyn' in d.filas[0]) && !('editUrl' in d.filas[0]));
  falla(() => como('jefe1@usil.edu.pe', () => F.panelDatos('bp')), /Sin acceso/); falla(() => como('jefe1@usil.edu.pe', () => F.panelDatos('gerencia')), /Sin acceso/);
});
ok('BP ve solo las solicitudes que le tocan', () => { const d = como('beto.bp@usil.edu.pe', () => F.panelDatos('bp')); assert.strictEqual(d.vistas.join(), 'jefe,bp'); assert.strictEqual(d.filas.length, 1); assert.strictEqual(d.filas[0].bp, 'Beto BP'); });
ok('Gerencia solo ve lo que el BP le pasó (al inicio, nada)', () => assert.strictEqual(como('karla@usil.edu.pe', () => F.panelDatos('gerencia')).filas.length, 0));
ok('detalle con títulos de preguntas; ajeno no disponible', () => {
  const id = como('jefe1@usil.edu.pe', () => F.panelDatos('jefe')).filas[0].id;
  const t = como('jefe1@usil.edu.pe', () => F.panelDetalle(id, 'jefe')); assert.ok(t.levantamiento.some(x => x[0] === '¿Qué posición requiere ser reemplazada?'));
  falla(() => como('jefe2@usil.edu.pe', () => F.panelDetalle(id, 'jefe')), /no disponible/);
});
ok('BP actualiza estado de lo suyo, no decide Aprobado ni toca lo ajeno', () => {
  const id = como('beto.bp@usil.edu.pe', () => F.panelDatos('bp')).filas[0].id;
  como('beto.bp@usil.edu.pe', () => F.panelActualizar(id, 'bp', 'En revisión BP', 'ok')); assert.strictEqual(como('beto.bp@usil.edu.pe', () => F.panelDatos('bp')).filas[0].estado, 'En revisión BP');
  falla(() => como('beto.bp@usil.edu.pe', () => F.panelActualizar(id, 'bp', 'Aprobado', '')), /Estado no permitido/);
  const ajeno = ent.rows.find(r => r[iBP] === 'Ana BP')[0];
  falla(() => como('beto.bp@usil.edu.pe', () => F.panelActualizar(ajeno, 'bp', 'En revisión BP', '')), /no disponible/);
});
ok('flujo: BP pasa a Gerencia → Gerencia decide; el BP ya no puede tocarlo; llegan los correos', () => {
  const id = como('beto.bp@usil.edu.pe', () => F.panelDatos('bp')).filas[0].id;
  como('beto.bp@usil.edu.pe', () => F.panelActualizar(id, 'bp', 'Enviado a Gerencia', 'Listo'));
  assert.ok(mails.some(m => /karla@usil.edu.pe/.test(m.to) && /Enviado a Gerencia/.test(m.subject)));
  falla(() => como('beto.bp@usil.edu.pe', () => F.panelActualizar(id, 'bp', 'En revisión BP', '')), /ya no está en tu etapa/);
  const g = como('karla@usil.edu.pe', () => F.panelDatos('gerencia')); assert.strictEqual(g.filas.length, 1);
  como('karla@usil.edu.pe', () => F.panelActualizar(id, 'gerencia', 'Aprobado', 'Va'));
  const f = como('karla@usil.edu.pe', () => F.panelDatos('gerencia')).filas[0]; assert.strictEqual(f.estado, 'Aprobado'); assert.strictEqual(f.comentarioGerencia, 'Va'); assert.strictEqual(f.comentarioBP, 'Listo');
  assert.ok(mails.some(m => /jefe1@usil.edu.pe/.test(m.to) && /Aprobado/.test(m.subject)));
  falla(() => como('jefe1@usil.edu.pe', () => F.panelActualizar(id, 'gerencia', 'Rechazado', '')), /Sin acceso/);
});
ok('Gerencia puede devolver al BP', () => {
  const id = como('karla@usil.edu.pe', () => F.panelDatos('gerencia')).filas[0].id;
  falla(() => como('karla@usil.edu.pe', () => F.panelActualizar(id, 'gerencia', 'Devuelto al jefe', '')), /Estado no permitido/);
  como('karla@usil.edu.pe', () => F.panelActualizar(id, 'gerencia', 'En revisión BP', 'Falta detalle'));
  assert.strictEqual(como('karla@usil.edu.pe', () => F.panelDatos('gerencia')).filas.length, 0);
  assert.strictEqual(como('beto.bp@usil.edu.pe', () => F.panelDatos('bp')).filas[0].estado, 'En revisión BP');
});
ok('la app web envía puntaje y alertas y el panel los muestra (acotados)', () => {
  const w = web(); w.id = 'EV1'; w.data.emailCliente = 'evaluado@usil.edu.pe'; w.evaluation = { score: 250, label: 'Caso bien preparado', strengths: ['Tiene presupuesto'], alerts: ['Falta evidencia'], recommendation: 'Pasar a Compensaciones' };
  F.CONFIG.MAX_GLOBAL_DIA = 300; assert.ok(post({ token: TOKEN, rec: w }).ok);
  const d = como('evaluado@usil.edu.pe', () => F.panelDetalle('EV1', 'jefe'));
  assert.strictEqual(d.puntaje, '100'); assert.strictEqual(d.alertas, 'Falta evidencia'); assert.strictEqual(d.clasificacion, 'Caso bien preparado');
  assert.strictEqual(como('evaluado@usil.edu.pe', () => F.panelDatos('jefe')).filas[0].puntaje, '100');
});
ok('BP devuelve al jefe (con correo) y al reenviar vuelve al BP', () => {
  ss.getSheetByName('BPs').rows.push(['Carla BP', 'carla.bp@usil.edu.pe', 'Socio de Negocio']);
  como('carla.bp@usil.edu.pe', () => F.panelActualizar('EV1', 'bp', 'Devuelto al jefe', 'Falta evidencia'));
  assert.ok(mails.some(m => /evaluado@usil.edu.pe/.test(m.to) && /Devuelto al jefe/.test(m.subject)));
  assert.strictEqual(como('evaluado@usil.edu.pe', () => F.panelDatos('jefe')).filas[0].estado, 'Devuelto al jefe');
  const w = web(); w.id = 'EV1'; w.data.emailCliente = 'evaluado@usil.edu.pe'; assert.ok(post({ token: TOKEN, rec: w }).ok);
  assert.strictEqual(como('evaluado@usil.edu.pe', () => F.panelDatos('jefe')).filas[0].estado, 'En revisión BP');
});
console.log('Maestro (autocompletado)');
const hm = ss.insertSheet('Maestro');
hm.rows = [['Matrícula', 'Nombre completo', 'Puesto', 'Situación', 'Departamento', 'Área', 'Sección', 'Email trabajo'],
  ['0000002458', 'Lucia Ramos Diaz', 'Analista Senior', 'ACTIVO', 'GERENCIA LEGAL', 'Contratos', 'Revisión', 'lramos@usil.edu.pe'],
  ['0000009999', 'Mario Lopez Vega', 'Jefe de Contratos', 'ACTIVO', 'GERENCIA LEGAL', 'Contratos', '', 'mario@usil.edu.pe']];
const mq = x => post(Object.assign({ token: TOKEN, accion: 'maestro', email: 'mario@usil.edu.pe' }, x));
ok('busca al colaborador por matrícula corta y devuelve solo 6 campos', () => { const r = mq({ codigo: '2458' }); assert.ok(r.ok); assert.strictEqual(r.item.nombre, 'Lucia Ramos Diaz'); assert.strictEqual(r.item.departamento, 'GERENCIA LEGAL'); assert.strictEqual(Object.keys(r.item).length, 6); assert.ok(!JSON.stringify(r).includes('lramos@')); });
ok('matrícula inexistente → null; inválida → error', () => { assert.strictEqual(mq({ codigo: '1234' }).item, null); assert.strictEqual(mq({ codigo: 'abc' }).error, 'Matrícula inválida'); });
ok('el cargo del líder sale de su correo', () => assert.strictEqual(mq({ lider: true }).item.puesto, 'Jefe de Contratos'));
ok('exige token y correo institucional', () => { assert.strictEqual(post({ accion: 'maestro', email: 'mario@usil.edu.pe', codigo: '2458' }).error, 'No autorizado'); assert.strictEqual(mq({ email: 'x@gmail.com', codigo: '2458' }).error, 'Usa tu correo institucional'); });
ok('límite de consultas por correo y hora', () => { F.CONFIG.MAX_CONSULTAS_HORA = 3; let r; for (let k = 0; k < 4; k++) r = mq({ email: 'barrido@usil.edu.pe', codigo: '2458' }); assert.ok(/Demasiadas consultas/.test(r.error)); F.CONFIG.MAX_CONSULTAS_HORA = 60; });
ok('demo: una persona activa al azar con área y sección completas', () => { const r = mq({ aleatorio: true }); assert.ok(r.ok && r.item.codigo && r.item.area && r.item.seccion); assert.strictEqual(r.item.nombre, 'Lucia Ramos Diaz'); });
ok('el receptor web acepta solicitudes sin área ni sección', () => { const w = web(); w.id = 'SINAREA'; w.data.emailCliente = 'sinarea@usil.edu.pe'; w.data.area = ''; w.data.seccion = ''; assert.ok(post({ token: TOKEN, rec: w }).ok); });

console.log('Panel con clave (sin sesión de Google)');
props.CLAVE_BP = 'clave-bp'; props.CLAVE_GERENCIA = 'clave-ger';
ok('HRBP entra con su correo y clave; solo ve la vista BP', () => {
  const s = como('', () => F.panelEntrar('beto.bp@usil.edu.pe', 'clave-bp')); assert.strictEqual(s.vistas.join(), 'bp');
  const d = como('', () => F.panelDatos('bp', s.token)); assert.ok(d.filas.every(f => f.bp === 'Beto BP'));
  falla(() => como('', () => F.panelDatos('gerencia', s.token)), /Sin acceso/);
});
ok('Gerencia entra con la clave de gerencia; la clave de BP no sirve para ella', () => {
  const s = como('', () => F.panelEntrar('karla@usil.edu.pe', 'clave-ger')); assert.strictEqual(s.vistas.join(), 'gerencia');
  assert.ok(Array.isArray(como('', () => F.panelDatos('gerencia', s.token)).filas));
  falla(() => como('', () => F.panelEntrar('karla@usil.edu.pe', 'clave-bp')), /incorrectos/);
});
ok('un jefe cualquiera no entra con la clave de BP', () => falla(() => como('', () => F.panelEntrar('jefe1@usil.edu.pe', 'clave-bp')), /incorrectos/));
ok('token falso o vencido se rechaza', () => falla(() => como('', () => F.panelDatos('bp', 'falso')), /sesión venció/));
ok('5 intentos fallidos bloquean al correo', () => { let e; for (let k = 0; k < 7; k++) { try { como('', () => F.panelEntrar('atacante@usil.edu.pe', 'x' + k)); } catch (x) { e = x; } } assert.ok(/Demasiados intentos/.test(e.message)); });
ok('sin clave configurada nadie entra por clave', () => { delete props.CLAVE_BP; falla(() => como('', () => F.panelEntrar('beto.bp@usil.edu.pe', '')), /incorrectos/); props.CLAVE_BP = 'clave-bp'; });
ok('exportar a Excel: BP y Gerencia reciben sus registros completos; el jefe no', () => {
  const r = como('beto.bp@usil.edu.pe', () => F.panelExportar('bp')); assert.ok(r.length >= 1 && r.every(x => x.bp === 'Beto BP'));
  assert.ok(r.every(x => Array.isArray(x.levantamiento) && Array.isArray(x.aprobaciones) && !('editUrl' in x)));
  assert.ok(r.some(x => x.levantamiento.some(p => /posición/.test(p[0]))));
  falla(() => como('jefe1@usil.edu.pe', () => F.panelExportar('jefe')), /Solo BP y Gerencia/);
  falla(() => como('beto.bp@usil.edu.pe', () => F.panelExportar('gerencia')), /Sin acceso/);
});
ok('la propiedad SIN_CORREOS apaga todos los correos', () => {
  props.SIN_CORREOS = '1'; const antes = mails.length;
  const w = web(); w.id = 'SC1'; w.data.emailCliente = 'sincorreo@usil.edu.pe'; assert.ok(post({ token: TOKEN, rec: w }).ok);
  como('carla.bp@usil.edu.pe', () => F.panelActualizar('SC1', 'bp', 'Devuelto al jefe', 'x'));
  assert.strictEqual(mails.length, antes); delete props.SIN_CORREOS;
});
ok('cargarRuteoDePrueba reparte los 16 departamentos entre los 4 BP (4 cada uno)', () => {
  F.cargarRuteoDePrueba();
  const filas = ss.getSheetByName('Ruteo').rows.slice(1, 17); assert.strictEqual(filas.length, 16);
  const porBP = {}; filas.forEach(r => { porBP[r[2]] = (porBP[r[2]] || 0) + 1; });
  assert.deepStrictEqual(Object.values(porBP), [4, 4, 4, 4]); assert.strictEqual(Object.keys(porBP).length, 4);
});
ok('demo: la persona al azar respeta el departamento pedido', () => { const r = mq({ aleatorio: true, departamento: 'GERENCIA LEGAL' }); assert.strictEqual(r.item.departamento, 'GERENCIA LEGAL'); });
ok('el receptor web acepta una solicitud casi vacia (solo correo, departamento y movimiento)', () => {
  const w = { id: 'VACIA1', data: { emailCliente: 'vacia@usil.edu.pe', cliente: 'Jefe Prueba', departamento: 'GERENCIA LEGAL', movimiento: 'Promoción', dynamic: {}, approvals: [] } };
  const r = post({ token: TOKEN, rec: w }); assert.ok(r.ok, JSON.stringify(r));
  const fila = ss.getSheetByName('Entradas').rows.find(x => x[0] === 'VACIA1'); assert.strictEqual(fila[6].length, 10); assert.strictEqual(fila[9], 'No indicada');
});
ok('el ruteo de prueba deja Gerencia de Talento y Cultura con Claudia', () => { const r = ss.getSheetByName('Ruteo').rows.find(x => x[0] === 'GERENCIA DE TALENTO Y CULTURA'); assert.strictEqual(r[2], 'Claudia Muñoz'); });
console.log('\n' + n + ' pruebas OK');

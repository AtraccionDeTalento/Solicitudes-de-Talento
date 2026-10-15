// Quién puede pedir: los jefes de área sí; las socias de negocio no (ni con su cuenta del panel ni con el alias +jefe). Contra el emulador: npm run test:rules (o node tests/rules-solicitantes.test.js con el emulador abierto).
const fs = require('fs');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, updateDoc } = require('firebase/firestore');

const DEP = 'GERENCIA DE TALENTO Y CULTURA';
const JEFE = 'jefe1@usil.edu.pe', SOCIA = 'socia@usil.edu.pe', SUBGERENTE = 'subgerente@usil.edu.pe', GER = 'ger1@usil.edu.pe';
const nueva = (id, uid, enviadoPor) => ({ id, uid, estado: 'Nuevo', bpId: 'bpid-1', comentarioBP: '', comentarioGerencia: '', enviadoPor, movimiento: 'Promoción', departamento: DEP, impactoDetalle: 'x', solicitudConcreta: 'y' });

(async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-rules-sol', firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async c => {
    const db = c.firestore();
    await setDoc(doc(db, 'config/app'), { modoPrueba: false, accesoAnonimo: false });
    await setDoc(doc(db, 'ruteo', DEP), { bpId: 'bpid-1' }); await setDoc(doc(db, 'bps', 'bpid-1'), { nombre: 'HRBP Uno' });
    await setDoc(doc(db, 'roles', SOCIA), { roles: ['bp'], bpId: 'bpid-1', pideComoJefe: false });          // socia de negocio: no pide
    await setDoc(doc(db, 'roles', SUBGERENTE), { roles: ['bp'], bpId: 'bpid-9', pideComoJefe: true });        // jefatura con rol de socio: sí pide
    await setDoc(doc(db, 'roles', GER), { roles: ['gerencia'] });                                              // sin marca: puede pedir
  });
  const ctx = (mail, uid) => env.authenticatedContext(uid, { email: mail, email_verified: true, firebase: { sign_in_provider: 'password' } }).firestore();
  const S = assertSucceeds, F = assertFails;
  let n = 0; const t = async (nombre, f) => { try { await f(); } catch (e) { console.log('  ✗', nombre); throw e; } n++; console.log('  ✓', nombre); };
  const crea = (db, id, uid, mail) => setDoc(doc(db, 'solicitudes', id), nueva(id, uid, mail));

  await t('un jefe de área (sin rol de panel) crea su solicitud', async () => { await S(crea(ctx(JEFE, 'u1'), 'J1', 'u1', JEFE)); });
  await t('una socia de negocio NO puede pedir con su cuenta del panel', async () => { await F(crea(ctx(SOCIA, 'u2'), 'S1', 'u2', SOCIA)); });
  await t('una socia de negocio NO puede pedir con el alias «usuario+jefe@» (aunque cree la cuenta ella misma)', async () => {
    await F(crea(ctx('socia+jefe@usil.edu.pe', 'u3'), 'S2', 'u3', 'socia+jefe@usil.edu.pe'));
  });
  await t('el Subgerente de Talento (rol de socio pero jefatura) sí pide, con su alias de jefe y con su cuenta', async () => {
    await S(crea(ctx('subgerente+jefe@usil.edu.pe', 'u4'), 'C1', 'u4', 'subgerente+jefe@usil.edu.pe')); await S(crea(ctx(SUBGERENTE, 'u5'), 'C2', 'u5', SUBGERENTE));
  });
  await t('Gerencia (sin la marca) sí puede pedir como jefe con su alias', async () => { await S(crea(ctx('ger1+jefe@usil.edu.pe', 'u6'), 'G1', 'u6', 'ger1+jefe@usil.edu.pe')); });
  await t('la marca no impide a la socia lo suyo: sigue leyendo y gestionando las solicitudes que le tocan', async () => {
    const socia = ctx(SOCIA, 'u2');
    await S(getDoc(doc(socia, 'solicitudes', 'J1')));
    await S(updateDoc(doc(socia, 'solicitudes', 'J1'), { estado: 'En revisión BP', gestionadoPor: SOCIA, gestionadoEl: 'hoy' }));
  });
  await t('hacerse pasar por otro: ni el correo de otra persona ni un correo ajeno sirven', async () => {
    await F(crea(ctx(JEFE, 'u1'), 'X1', 'u1', SOCIA)); await F(crea(ctx(SOCIA, 'u2'), 'X2', 'u2', JEFE));
  });
  await env.cleanup();
  console.log('\n' + n + ' pruebas de quién puede pedir OK');
})().catch(e => { console.error(e); process.exit(1); });

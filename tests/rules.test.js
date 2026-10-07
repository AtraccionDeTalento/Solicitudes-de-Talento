// Reglas de seguridad de Firestore contra el emulador. Ejecutar: npm run test:rules (necesita Java).
const fs = require('fs');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, getDocs, updateDoc, collection, query, where, limit } = require('firebase/firestore');

const DEP = 'GERENCIA DE TALENTO Y CULTURA';
const J1 = 'jefe1@dni.invalid', OTRO = 'otro@dni.invalid', BP1 = 'bp1@dni.invalid', BP2 = 'bp2@dni.invalid', GER = 'ger1@dni.invalid', INTRUSO = 'x@dni.invalid';
const nueva = (id, uid, extra = {}) => ({ id, uid, estado: 'Nuevo', bp: 'HRBP Uno', bpCorreo: BP1, comentarioBP: '', comentarioGerencia: '',
  enviadoPor: J1, movimiento: 'Promoción', departamento: DEP, impactoDetalle: 'x', solicitudConcreta: 'y', ...extra });

(async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-rules', firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async c => {
    const db = c.firestore();
    await setDoc(doc(db, 'config/app'), { modoPrueba: true });
    await setDoc(doc(db, 'ruteo', DEP), { nombre: 'HRBP Uno', correo: BP1 });
    await setDoc(doc(db, 'lideres', J1), { nombre: 'Jefe Uno', puesto: 'JEFE' });
    await setDoc(doc(db, 'lideres', OTRO), { nombre: 'Otro', puesto: 'JEFE' });
    await setDoc(doc(db, 'roles', BP1), { nombre: 'HRBP Uno', roles: ['bp'] });
    await setDoc(doc(db, 'roles', BP2), { nombre: 'HRBP Dos', roles: ['bp'] });
    await setDoc(doc(db, 'roles', GER), { nombre: 'Gerencia', roles: ['gerencia'] });
    await setDoc(doc(db, 'maestro/0000000001'), { nombre: 'Ana', departamento: DEP, situacion: 'Activo' });
    await setDoc(doc(db, 'solicitudes/S-GER'), nueva('S-GER', 'otro', { estado: 'Enviado a Gerencia', enviadoPor: OTRO }));
    await setDoc(doc(db, 'solicitudes/S-NUEVA'), nueva('S-NUEVA', 'otro', { enviadoPor: OTRO }));
  });
  const ctx = (id, extra = {}) => env.authenticatedContext('uid-' + id, { email: id, email_verified: true, firebase: { sign_in_provider: 'password' }, ...extra }).firestore();
  const jefe = ctx(J1), bp1 = ctx(BP1), bp2 = ctx(BP2), ger = ctx(GER), intruso = ctx(INTRUSO);
  const sol = (db, id) => doc(db, 'solicitudes', id);
  let n = 0; const t = async (nombre, f) => { await f(); n++; console.log('  ✓', nombre); };
  const uidJefe = 'uid-' + J1;

  await t('sin sesión no lee nada', () => assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'ruteo', DEP))));
  await t('Google, anónimo o sin verificar no entran', async () => {
    const otro = extra => env.authenticatedContext('u9', extra).firestore();
    await assertFails(getDoc(doc(otro({ email: 'x@gmail.com', email_verified: true, firebase: { sign_in_provider: 'google.com' } }), 'ruteo', DEP)));
    await assertFails(getDoc(doc(otro({ firebase: { sign_in_provider: 'anonymous' } }), 'ruteo', DEP)));
    await assertFails(getDoc(doc(otro({ email: J1, email_verified: false, firebase: { sign_in_provider: 'password' } }), 'ruteo', DEP)));
  });
  await t('una cuenta creada por un tercero (sin registro en lideres ni roles) no accede a nada', async () => {
    await assertFails(getDoc(doc(intruso, 'ruteo', DEP))); await assertFails(getDoc(doc(intruso, 'maestro/0000000001')));
    await assertFails(setDoc(sol(intruso, 'I1'), nueva('I1', 'uid-' + INTRUSO, { enviadoPor: INTRUSO })));
  });
  await t('un jefe autorizado crea su solicitud', () => assertSucceeds(setDoc(sol(jefe, 'A1'), nueva('A1', uidJefe))));
  await t('rechaza un BP que no es el del ruteo', () => assertFails(setDoc(sol(jefe, 'A2'), nueva('A2', uidJefe, { bpCorreo: BP2 }))));
  await t('no se puede enviar a nombre de otra persona', () => assertFails(setDoc(sol(jefe, 'A3'), nueva('A3', uidJefe, { enviadoPor: OTRO }))));
  await t('rechaza crearla ya aprobada, con uid ajeno o movimiento inválido', async () => {
    await assertFails(setDoc(sol(jefe, 'A4'), nueva('A4', uidJefe, { estado: 'Aprobado' })));
    await assertFails(setDoc(sol(jefe, 'A5'), nueva('A5', 'otro')));
    await assertFails(setDoc(sol(jefe, 'A6'), nueva('A6', uidJefe, { movimiento: 'Hack' })));
  });
  await t('el jefe lee la suya, no las ajenas, no la modifica y no lista', async () => {
    await assertSucceeds(getDoc(sol(jefe, 'A1'))); await assertFails(getDoc(sol(jefe, 'S-NUEVA')));
    await assertFails(updateDoc(sol(jefe, 'A1'), { estado: 'Aprobado' })); await assertFails(getDocs(collection(jefe, 'solicitudes')));
  });
  await t('el BP lista solo las suyas y otro BP no lee la ajena', async () => {
    await assertSucceeds(getDocs(query(collection(bp1, 'solicitudes'), where('bpCorreo', '==', BP1))));
    await assertFails(getDocs(query(collection(bp1, 'solicitudes'), where('bpCorreo', '==', BP2))));
    await assertFails(getDoc(sol(bp2, 'S-NUEVA')));
  });
  await t('el BP cambia estado y comentario, pero no aprueba ni toca otros campos', async () => {
    await assertSucceeds(updateDoc(sol(bp1, 'S-NUEVA'), { estado: 'Enviado a Gerencia', comentarioBP: 'ok', gestionadoPor: BP1, gestionadoEl: 'hoy' }));
    await assertFails(updateDoc(sol(bp1, 'A1'), { estado: 'Aprobado', gestionadoPor: BP1 }));
    await assertFails(updateDoc(sol(bp1, 'A1'), { estado: 'En pausa', gestionadoPor: BP1, impactoDetalle: 'otro' }));
    await assertFails(updateDoc(sol(bp1, 'A1'), { estado: 'En pausa', gestionadoPor: BP2 }));
  });
  await t('Gerencia ve y decide solo lo que le pasaron', async () => {
    await assertSucceeds(getDocs(query(collection(ger, 'solicitudes'), where('estado', 'in', ['Enviado a Gerencia', 'Aprobado', 'Rechazado']))));
    await assertFails(getDoc(sol(ger, 'A1')));
    await assertSucceeds(updateDoc(sol(ger, 'S-GER'), { estado: 'Aprobado', comentarioGerencia: 'listo', gestionadoPor: GER, gestionadoEl: 'hoy' }));
    await assertFails(updateDoc(sol(bp1, 'S-GER'), { estado: 'En pausa', gestionadoPor: BP1 }));
  });
  await t('maestro: get sí; la lista solo en modo prueba y con límite', async () => {
    await assertSucceeds(getDoc(doc(jefe, 'maestro/0000000001')));
    await assertSucceeds(getDocs(query(collection(jefe, 'maestro'), where('departamento', '==', DEP), limit(30))));
    await assertFails(getDocs(collection(jefe, 'maestro')));
    await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'config/app'), { modoPrueba: false }));
    await assertFails(getDocs(query(collection(jefe, 'maestro'), limit(30))));
  });
  await t('cada quien lee solo su propio registro (nadie lista ni prueba identificadores ajenos)', async () => {
    await assertSucceeds(getDoc(doc(jefe, 'lideres', J1))); await assertFails(getDoc(doc(jefe, 'lideres', OTRO))); await assertFails(getDocs(collection(jefe, 'lideres')));
    await assertSucceeds(getDoc(doc(bp1, 'roles', BP1))); await assertFails(getDoc(doc(bp1, 'roles', GER))); await assertFails(getDoc(doc(jefe, 'roles', BP1)));
  });
  await t('nadie escribe ruteo, roles ni lideres', async () => {
    await assertFails(setDoc(doc(bp1, 'ruteo', DEP), { nombre: 'x', correo: 'x' }));
    await assertFails(setDoc(doc(ger, 'roles', 'z@dni.invalid'), { roles: ['gerencia'] }));
    await assertFails(setDoc(doc(jefe, 'lideres', 'z@dni.invalid'), { nombre: 'z' }));
  });
  await env.cleanup();
  console.log('\n' + n + ' pruebas de reglas OK');
})().catch(e => { console.error(e); process.exit(1); });

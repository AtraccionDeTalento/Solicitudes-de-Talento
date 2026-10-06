// Reglas de seguridad de Firestore contra el emulador. Ejecutar: npm run test:rules (necesita Java).
const fs = require('fs');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, getDocs, updateDoc, collection, query, where, limit } = require('firebase/firestore');

const DEP = 'GERENCIA DE TALENTO Y CULTURA';
const nueva = (id, uid, extra = {}) => ({ id, uid, estado: 'Nuevo', bp: 'Claudia Muñoz', bpCorreo: 'cmunozse@usil.edu.pe', comentarioBP: '', comentarioGerencia: '',
  enviadoPor: 'creyess@usil.edu.pe', movimiento: 'Promoción', departamento: DEP, impactoDetalle: 'x', solicitudConcreta: 'y', ...extra });

(async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-rules', firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
  await env.withSecurityRulesDisabled(async c => {
    const db = c.firestore();
    await setDoc(doc(db, 'config/app'), { modoPrueba: true });
    await setDoc(doc(db, 'ruteo', DEP), { nombre: 'Claudia Muñoz', correo: 'cmunozse@usil.edu.pe' });
    await setDoc(doc(db, 'roles/cmunozse@usil.edu.pe'), { roles: ['bp'] });
    await setDoc(doc(db, 'roles/msalazar@usil.edu.pe'), { roles: ['bp'] });
    await setDoc(doc(db, 'roles/jlopezp@usil.edu.pe'), { roles: ['gerencia'] });
    await setDoc(doc(db, 'maestro/0000000001'), { nombre: 'Ana', departamento: DEP, situacion: 'Activo' });
    await setDoc(doc(db, 'solicitudes/S-GER'), nueva('S-GER', 'otro', { estado: 'Enviado a Gerencia' }));
    await setDoc(doc(db, 'solicitudes/S-NUEVA'), nueva('S-NUEVA', 'otro'));
  });
  const anon = env.authenticatedContext('u1', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  const pass = mail => env.authenticatedContext(mail, { email: mail, firebase: { sign_in_provider: 'password' } }).firestore();
  const claudia = pass('cmunozse@usil.edu.pe'), fatima = pass('msalazar@usil.edu.pe'), ger = pass('jlopezp@usil.edu.pe');
  const sol = (db, id) => doc(db, 'solicitudes', id);
  let n = 0; const t = async (nombre, f) => { await f(); n++; console.log('  ✓', nombre); };

  await t('sin sesión no lee nada', () => assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'ruteo', DEP))));
  await t('un jefe anónimo crea su solicitud', () => assertSucceeds(setDoc(sol(anon, 'A1'), nueva('A1', 'u1'))));
  await t('rechaza un BP que no es el del ruteo', () => assertFails(setDoc(sol(anon, 'A2'), nueva('A2', 'u1', { bpCorreo: 'mhiga@usil.edu.pe' }))));
  await t('rechaza correo fuera de usil.edu.pe', () => assertFails(setDoc(sol(anon, 'A3'), nueva('A3', 'u1', { enviadoPor: 'x@gmail.com' }))));
  await t('rechaza crearla ya aprobada', () => assertFails(setDoc(sol(anon, 'A4'), nueva('A4', 'u1', { estado: 'Aprobado' }))));
  await t('rechaza uid ajeno', () => assertFails(setDoc(sol(anon, 'A5'), nueva('A5', 'otro'))));
  await t('rechaza movimiento inválido', () => assertFails(setDoc(sol(anon, 'A6'), nueva('A6', 'u1', { movimiento: 'Hack' }))));
  await t('el jefe lee la suya y no las ajenas', async () => { await assertSucceeds(getDoc(sol(anon, 'A1'))); await assertFails(getDoc(sol(anon, 'S-NUEVA'))); });
  await t('el jefe no puede modificarla', () => assertFails(updateDoc(sol(anon, 'A1'), { estado: 'Aprobado' })));
  await t('el jefe no lista solicitudes ajenas', () => assertFails(getDocs(collection(anon, 'solicitudes'))));
  await t('el BP lista solo las suyas', async () => {
    await assertSucceeds(getDocs(query(collection(claudia, 'solicitudes'), where('bpCorreo', '==', 'cmunozse@usil.edu.pe'))));
    await assertFails(getDocs(query(collection(claudia, 'solicitudes'), where('bpCorreo', '==', 'msalazar@usil.edu.pe'))));
  });
  await t('otro BP no lee la solicitud ajena', () => assertFails(getDoc(sol(fatima, 'S-NUEVA'))));
  await t('el BP cambia estado y comentario', () => assertSucceeds(updateDoc(sol(claudia, 'S-NUEVA'), { estado: 'Enviado a Gerencia', comentarioBP: 'ok', gestionadoPor: 'cmunozse@usil.edu.pe', gestionadoEl: 'hoy' })));
  await t('el BP no aprueba ni toca otros campos', async () => {
    await assertFails(updateDoc(sol(claudia, 'A1'), { estado: 'Aprobado', gestionadoPor: 'cmunozse@usil.edu.pe' }));
    await assertFails(updateDoc(sol(claudia, 'A1'), { estado: 'En pausa', gestionadoPor: 'cmunozse@usil.edu.pe', impactoDetalle: 'otro' }));
    await assertFails(updateDoc(sol(claudia, 'A1'), { estado: 'En pausa', gestionadoPor: 'otra@usil.edu.pe' }));
  });
  await t('Gerencia ve lo enviado a Gerencia y no lo nuevo', async () => {
    await assertSucceeds(getDocs(query(collection(ger, 'solicitudes'), where('estado', 'in', ['Enviado a Gerencia', 'Aprobado', 'Rechazado']))));
    await assertFails(getDoc(sol(ger, 'A1')));
  });
  await t('Gerencia aprueba con comentario', () => assertSucceeds(updateDoc(sol(ger, 'S-GER'), { estado: 'Aprobado', comentarioGerencia: 'listo', gestionadoPor: 'jlopezp@usil.edu.pe', gestionadoEl: 'hoy' })));
  await t('el BP ya no toca lo aprobado', () => assertFails(updateDoc(sol(claudia, 'S-GER'), { estado: 'En pausa', gestionadoPor: 'cmunozse@usil.edu.pe' })));
  await t('el maestro: get sí, lista solo con límite en modo prueba', async () => {
    await assertSucceeds(getDoc(doc(anon, 'maestro/0000000001')));
    await assertSucceeds(getDocs(query(collection(anon, 'maestro'), where('departamento', '==', DEP), limit(30))));
    await assertFails(getDocs(collection(anon, 'maestro')));
  });
  await t('fuera del modo prueba el maestro no se puede listar', async () => {
    await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'config/app'), { modoPrueba: false }));
    await assertFails(getDocs(query(collection(anon, 'maestro'), limit(30))));
  });
  await t('roles: cada quien lee solo el suyo y un anónimo no lee ninguno', async () => {
    await assertSucceeds(getDoc(doc(claudia, 'roles/cmunozse@usil.edu.pe')));
    await assertFails(getDoc(doc(claudia, 'roles/jlopezp@usil.edu.pe')));
    await assertFails(getDoc(doc(anon, 'roles/cmunozse@usil.edu.pe')));
  });
  await t('nadie escribe ruteo ni roles', async () => {
    await assertFails(setDoc(doc(claudia, 'ruteo', DEP), { nombre: 'x', correo: 'x' }));
    await assertFails(setDoc(doc(ger, 'roles/z@usil.edu.pe'), { roles: ['gerencia'] }));
  });
  await env.cleanup();
  console.log('\n' + n + ' pruebas de reglas OK');
})().catch(e => { console.error(e); process.exit(1); });

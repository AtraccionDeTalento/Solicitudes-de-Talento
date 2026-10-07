// Reglas de seguridad de Firestore contra el emulador. Ejecutar: npm run test:rules (necesita Java).
const fs = require('fs');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, getDocs, updateDoc, collection, query, where, limit } = require('firebase/firestore');

const DEP = 'GERENCIA DE TALENTO Y CULTURA';
const BP1 = 'bp1@usil.edu.pe', BP2 = 'bp2@usil.edu.pe', GER = 'ger1@usil.edu.pe', JEFE = 'jefe1@usil.edu.pe', OTRO = 'otro@usil.edu.pe';
const nueva = (id, uid, extra = {}) => ({ id, uid, estado: 'Nuevo', bpId: 'bpid-1', comentarioBP: '', comentarioGerencia: '',
  enviadoPor: JEFE, movimiento: 'Promoción', departamento: DEP, impactoDetalle: 'x', solicitudConcreta: 'y', ...extra });

(async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-rules', firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
  await env.clearFirestore();
  const prueba = valor => env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'config/app'), { modoPrueba: valor }));
  await env.withSecurityRulesDisabled(async c => {
    const db = c.firestore();
    await setDoc(doc(db, 'ruteo', DEP), { bpId: 'bpid-1' });
    await setDoc(doc(db, 'bps', 'bpid-1'), { nombre: 'HRBP Uno' });
    await setDoc(doc(db, 'lideres', JEFE), { nombre: 'Jefe Uno', puesto: 'JEFE' });
    await setDoc(doc(db, 'roles', BP1), { roles: ['bp'], bpId: 'bpid-1' });
    await setDoc(doc(db, 'roles', BP2), { roles: ['bp'], bpId: 'bpid-2' });
    await setDoc(doc(db, 'roles', GER), { roles: ['gerencia'] });
    await setDoc(doc(db, 'maestro/0000000001'), { nombre: 'Ana', departamento: DEP, situacion: 'Activo' });
    await setDoc(doc(db, 'solicitudes/S-GER'), nueva('S-GER', 'otro', { estado: 'Enviado a Gerencia', enviadoPor: OTRO }));
    await setDoc(doc(db, 'solicitudes/S-NUEVA'), nueva('S-NUEVA', 'otro', { enviadoPor: OTRO }));
  });
  await prueba(false);   // PRODUCCIÓN: modoPrueba apagado
  const anon = env.authenticatedContext('u1', { firebase: { sign_in_provider: 'anonymous' } }).firestore();   // el jefe: nombre y correo escritos
  const staff = mail => env.authenticatedContext(mail, { email: mail, email_verified: true, firebase: { sign_in_provider: 'password' } }).firestore();
  const bp1 = staff(BP1), bp2 = staff(BP2), ger = staff(GER);
  const sol = (db, id) => doc(db, 'solicitudes', id);
  let n = 0; const t = async (nombre, f) => { await f(); n++; console.log('  ✓', nombre); };

  await t('sin sesión no lee nada', () => assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'ruteo', DEP))));
  await t('Google o un correo sin verificar no entran', async () => {
    const otro = extra => env.authenticatedContext('u9', extra).firestore();
    await assertFails(getDoc(doc(otro({ email: 'x@gmail.com', email_verified: true, firebase: { sign_in_provider: 'google.com' } }), 'ruteo', DEP)));
    await assertFails(getDoc(doc(otro({ email: BP1, email_verified: false, firebase: { sign_in_provider: 'password' } }), 'roles', BP1)));
  });
  await t('un jefe (sesión anónima) crea su solicitud con un correo @usil.edu.pe, también en producción', () => assertSucceeds(setDoc(sol(anon, 'A1'), nueva('A1', 'u1'))));
  await t('rechaza correo fuera de usil.edu.pe, otro BP, aprobada ya, uid ajeno o movimiento inválido', async () => {
    await assertFails(setDoc(sol(anon, 'A2'), nueva('A2', 'u1', { enviadoPor: 'x@gmail.com' })));
    await assertFails(setDoc(sol(anon, 'A3'), nueva('A3', 'u1', { bpId: 'bpid-2' })));
    await assertFails(setDoc(sol(anon, 'A4'), nueva('A4', 'u1', { estado: 'Aprobado' })));
    await assertFails(setDoc(sol(anon, 'A5'), nueva('A5', 'otro')));
    await assertFails(setDoc(sol(anon, 'A6'), nueva('A6', 'u1', { movimiento: 'Hack' })));
  });
  await t('el jefe lee la suya, no las ajenas, no la modifica, no lista y no lee líderes ni roles', async () => {
    await assertSucceeds(getDoc(sol(anon, 'A1'))); await assertFails(getDoc(sol(anon, 'S-NUEVA')));
    await assertFails(updateDoc(sol(anon, 'A1'), { estado: 'Aprobado' })); await assertFails(getDocs(collection(anon, 'solicitudes')));
    await assertFails(getDoc(doc(anon, 'lideres', JEFE))); await assertFails(getDoc(doc(anon, 'roles', BP1)));
  });
  await t('PRODUCCIÓN: el jefe sin verificar NO lee el Maestro (ni por matrícula ni en lista)', async () => {
    await assertFails(getDoc(doc(anon, 'maestro/0000000001')));
    await assertFails(getDocs(query(collection(anon, 'maestro'), where('departamento', '==', DEP), limit(30))));
  });
  await t('modo prueba: el jefe sí puede consultar el Maestro, la lista solo con límite', async () => {
    await prueba(true);
    await assertSucceeds(getDoc(doc(anon, 'maestro/0000000001')));
    await assertSucceeds(getDocs(query(collection(anon, 'maestro'), where('departamento', '==', DEP), limit(30))));
    await assertFails(getDocs(collection(anon, 'maestro')));
    await prueba(false);
  });
  await t('HRBP y Gerencia: Maestro por matrícula sí; la lista cerrada en producción', async () => {
    await assertSucceeds(getDoc(doc(bp1, 'maestro/0000000001')));
    await assertFails(getDocs(query(collection(bp1, 'maestro'), limit(30))));
  });
  await t('el BP lista solo las suyas y otro BP no lee la ajena', async () => {
    await assertSucceeds(getDocs(query(collection(bp1, 'solicitudes'), where('bpId', '==', 'bpid-1'))));
    await assertFails(getDocs(query(collection(bp1, 'solicitudes'), where('bpId', '==', 'bpid-2'))));
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
  await t('cada persona del panel lee solo su rol y su cargo; nadie escribe ruteo ni roles', async () => {
    await assertSucceeds(getDoc(doc(bp1, 'roles', BP1))); await assertFails(getDoc(doc(bp1, 'roles', GER)));
    await assertFails(setDoc(doc(bp1, 'ruteo', DEP), { nombre: 'x', correo: 'x' })); await assertFails(setDoc(doc(ger, 'roles', 'z@usil.edu.pe'), { roles: ['gerencia'] }));
  });
  await t('NADIE sin sesión de personal extrae nombres ni correos de los BP: el ruteo solo trae un identificador opaco', async () => {
    const r = await getDoc(doc(anon, 'ruteo', DEP));
    if (JSON.stringify(Object.keys(r.data())) !== '["bpId"]') throw new Error('el ruteo expone más que bpId: ' + JSON.stringify(r.data()));
    await assertFails(getDoc(doc(anon, 'bps', 'bpid-1'))); await assertFails(getDocs(collection(anon, 'bps')));
    await assertSucceeds(getDocs(collection(bp1, 'bps'))); await assertFails(setDoc(doc(bp1, 'bps', 'bpid-1'), { nombre: 'x' }));
  });
  await t('el jefe no puede escribir el nombre ni el correo del BP en su solicitud', async () => {
    await assertFails(setDoc(sol(anon, 'A9'), nueva('A9', 'u1', { bp: 'Quien sea' })));
    await assertFails(setDoc(sol(anon, 'A10'), nueva('A10', 'u1', { bpCorreo: BP1 })));
  });
  await t('una solicitud COMPLETA (todos los campos de la app, con textos largos) sí se guarda: las reglas no se pasan del límite de 1000 expresiones', async () => {
    const largo = n => 'x'.repeat(n);
    const completa = nueva('FULL1', 'u1', {
      enviadoEl: '2026-10-07T12:00:00.000Z', origen: 'web', periodo: '2026-10', fechaSolicitud: '2026-10-07', cliente: largo(100), cargoCliente: largo(100), area: largo(100), seccion: largo(100),
      codigo: '0000000001', colaborador: largo(100), puestoActual: largo(100), tieneAprobacion: 'Sí', presupuesto: 'Sí', fuentePresupuesto: 'Presupuesto aprobado', validaPresupuesto: largo(100),
      montoPresupuesto: '4500', urgencia: 'Inmediato', impacto: 'Alto', consecuencia: 'Retraso operativo', impactoDetalle: largo(950), solicitudConcreta: largo(2900),
      puntaje: '96', clasificacion: 'Caso bien preparado', fortalezas: largo(1500), alertas: largo(1500), recomendacion: largo(700),
      levantamiento: Array.from({ length: 40 }, (_, i) => ({ p: 'Pregunta ' + i, r: largo(300) })), aprobaciones: [{ level: 'a', name: 'b' }, { level: 'a' }, { level: 'c' }] });
    await assertSucceeds(setDoc(sol(anon, 'FULL1'), completa));
  });
  await t('la base no acepta campos ajenos al formulario, textos enormes ni listas gigantes', async () => {
    await assertFails(setDoc(sol(anon, 'B1'), nueva('B1', 'u1', { campoInventado: 'x' })));
    await assertFails(setDoc(sol(anon, 'B2'), nueva('B2', 'u1', { cliente: 'x'.repeat(400) })));
    await assertFails(setDoc(sol(anon, 'B3'), nueva('B3', 'u1', { impactoDetalle: 'x'.repeat(1001) })));
    await assertFails(setDoc(sol(anon, 'B4'), nueva('B4', 'u1', { levantamiento: Array.from({ length: 200 }, () => ({ p: 'a', r: 'b' })) })));
    await assertFails(setDoc(sol(anon, 'B5'), nueva('B5', 'u1', { aprobaciones: [{}, {}, {}, {}] })));
    await assertFails(setDoc(sol(anon, 'B6'), nueva('B6', 'u1', { cliente: { a: 1 } })));
    await assertSucceeds(setDoc(sol(anon, 'B7'), nueva('B7', 'u1', { cliente: 'Nombre normal', levantamiento: [{ p: 'a', r: 'b' }], aprobaciones: [{}] })));
  });
  await t('el texto para Gerencia lo escribe solo el Business Partner al escalar, con tope de tamaño; el jefe y Gerencia no pueden', async () => {
    await assertSucceeds(setDoc(sol(anon, 'T1'), nueva('T1', 'u1'))); await assertSucceeds(setDoc(sol(anon, 'T2'), nueva('T2', 'u1')));
    const gestion = extra => ({ estado: 'Enviado a Gerencia', comentarioBP: 'ok', gestionadoPor: BP1, gestionadoEl: 'hoy', ...extra });
    await assertFails(setDoc(sol(anon, 'T3'), nueva('T3', 'u1', { textoGerencia: 'el jefe no puede escribirlo' })));
    await assertFails(updateDoc(sol(anon, 'T1'), { textoGerencia: 'x' }));
    await assertFails(updateDoc(sol(bp1, 'T1'), gestion({ textoGerencia: 'x'.repeat(20001), textoOrigen: 'motor' })));
    await assertFails(updateDoc(sol(bp1, 'T1'), gestion({ textoGerencia: 'texto', textoOrigen: 'o'.repeat(31) })));
    await assertFails(updateDoc(sol(bp1, 'T1'), gestion({ textoGerencia: 'texto', otroCampo: 'x' })));
    await assertSucceeds(updateDoc(sol(bp1, 'T1'), gestion({ textoGerencia: 'SOLICITUD DE PROMOCIÓN\n1. DECISIÓN QUE SE SOLICITA', textoOrigen: 'motor+editado' })));
    await assertFails(updateDoc(sol(ger, 'S-GER'), { estado: 'Aprobado', comentarioGerencia: 'x', gestionadoPor: GER, gestionadoEl: 'hoy', textoGerencia: 'Gerencia no reescribe el texto del BP' }));
  });
  await env.cleanup();
  console.log('\n' + n + ' pruebas de reglas OK');
})().catch(e => { console.error(e); process.exit(1); });

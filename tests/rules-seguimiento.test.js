// Reglas del seguimiento visible para todos y del presupuesto confirmado por el HRBP, contra el emulador. Se ejecuta con npm run test:rules (después de rules.test.js).
const fs = require('fs');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, getDocs, updateDoc, collection, query, where, writeBatch } = require('firebase/firestore');

const DEP = 'GERENCIA DE TALENTO Y CULTURA';
const JEFE = 'jefe1@usil.edu.pe', JEFE2 = 'jefe2@usil.edu.pe', BP1 = 'bp1@usil.edu.pe', BP2 = 'bp2@usil.edu.pe', GER = 'ger1@usil.edu.pe';
const nueva = (id, uid, extra = {}) => ({ id, uid, estado: 'Nuevo', bpId: 'bpid-1', comentarioBP: '', comentarioGerencia: '', enviadoPor: JEFE, movimiento: 'Promoción', departamento: DEP, impactoDetalle: 'x', solicitudConcreta: 'y', ...extra });
const gest = (por, estado, extra = {}) => ({ estado, gestionadoPor: por, gestionadoEl: 'hoy', ...extra });
const ev = (id, a, por, extra = {}) => ({ solicitudId: id, bpId: 'bpid-1', tipo: 'Cambio de estado', de: 'Nuevo', a, por, rol: 'bp', fecha: 'hoy', comentario: '', ...extra });
const tz = (id, a, uid, extra = {}) => ({ solicitudId: id, uid, tipo: 'Cambio de estado', de: 'Nuevo', a, rol: 'bp', fecha: 'hoy', comentario: '', ...extra });

(async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-rules-seg', firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
  await env.clearFirestore();
  const admin = f => env.withSecurityRulesDisabled(c => f(c.firestore()));
  await admin(async db => {
    await setDoc(doc(db, 'config/app'), { modoPrueba: false, accesoAnonimo: false });
    await setDoc(doc(db, 'ruteo', DEP), { bpId: 'bpid-1' });
    await setDoc(doc(db, 'bps', 'bpid-1'), { nombre: 'HRBP Uno' }); await setDoc(doc(db, 'bps', 'bpid-2'), { nombre: 'HRBP Dos' });
    await setDoc(doc(db, 'roles', BP1), { roles: ['bp'], bpId: 'bpid-1' }); await setDoc(doc(db, 'roles', BP2), { roles: ['bp'], bpId: 'bpid-2' }); await setDoc(doc(db, 'roles', GER), { roles: ['gerencia'] });
    for (const n of ['S1', 'S2', 'S3', 'S4', 'S5']) await setDoc(doc(db, 'solicitudes', n), nueva(n, 'uj'));
  });
  const ctx = (mail, uid) => env.authenticatedContext(uid || mail, { email: mail, email_verified: true, firebase: { sign_in_provider: 'password' } }).firestore();
  const jefe = ctx(JEFE, 'uj'), jefe2 = ctx(JEFE2, 'uj2'), bp1 = ctx(BP1), bp2 = ctx(BP2), ger = ctx(GER);
  const S = assertSucceeds, F = assertFails;
  let n = 0; const t = async (nombre, f) => { try { await f(); } catch (e) { console.log('  ✗', nombre); throw e; } n++; console.log('  ✓', nombre); };
  const R = (db, id) => doc(db, 'solicitudes', id), INT = (db, id) => doc(db, 'solicitudes', id, 'interno', 'presupuesto');
  const pres = (por = BP1, extra = {}) => ({ monto: 'S/ 45,000', nota: 'Partida de remuneraciones 2027', por, fecha: 'hoy', ...extra });
  // Una gestión completa del HRBP = solicitud + evento + traza (+ presupuesto) en un solo lote, como hace el panel.
  const gestionar = (db, id, cambios, opciones = {}) => {
    const b = writeBatch(db), a = cambios.estado;
    b.update(R(db, id), cambios);
    b.set(doc(db, 'eventos', 'EV-' + id + '-' + a + (opciones.sufijo || '')), ev(id, a, opciones.por || BP1, opciones.evento));
    b.set(doc(db, 'trazas', 'TZ-' + id + '-' + a + (opciones.sufijo || '')), tz(id, opciones.trazaA || a, 'uj', opciones.traza));
    if (opciones.presupuesto) b.set(INT(db, id), opciones.presupuesto);
    return b.commit();
  };

  await t('el jefe NO puede fijar ni cambiar «presupuestoConfirmado» (ni al crear ni después)', async () => {
    const dueno = ctx(JEFE, 'uj9');
    await F(setDoc(R(dueno, 'N1'), nueva('N1', 'uj9', { presupuestoConfirmado: 'Sí' })));
    await F(updateDoc(R(jefe, 'S1'), { presupuestoConfirmado: 'Sí' }));
    await F(updateDoc(R(jefe, 'S1'), { estado: 'En revisión BP', gestionadoPor: JEFE, presupuestoConfirmado: 'Sí' }));
  });
  await t('el HRBP confirma Sí o No; otro valor, otro HRBP o Gerencia no pueden', async () => {
    await F(updateDoc(R(bp1, 'S1'), gest(BP1, 'En revisión BP', { presupuestoConfirmado: 'Quizás' })));
    await F(updateDoc(R(bp2, 'S1'), gest(BP2, 'En revisión BP', { presupuestoConfirmado: 'Sí' })));
    await S(updateDoc(R(bp1, 'S1'), gest(BP1, 'En revisión BP', { presupuestoConfirmado: 'No' })));
    await S(updateDoc(R(bp1, 'S1'), gest(BP1, 'En revisión BP', { presupuestoConfirmado: 'Sí' })));
  });
  await t('sin confirmar presupuesto no se escala a Gerencia; con la confirmación (ya guardada o en el mismo cambio) sí', async () => {
    await F(updateDoc(R(bp1, 'S2'), gest(BP1, 'Enviado a Gerencia')));
    await F(updateDoc(R(bp1, 'S2'), gest(BP1, 'Enviado a Gerencia', { presupuestoConfirmado: '' })));
    await S(updateDoc(R(bp1, 'S2'), gest(BP1, 'Enviado a Gerencia', { presupuestoConfirmado: 'Sí' })));
    await admin(db => updateDoc(R(db, 'S3'), { presupuestoConfirmado: 'No' }));          // confirmado en una gestión anterior
    await S(updateDoc(R(bp1, 'S3'), gest(BP1, 'Enviado a Gerencia')));
  });
  await t('el monto vive aparte: lo escribe y lo lee solo el HRBP de la solicitud; el jefe nunca', async () => {
    await F(setDoc(INT(jefe, 'S4'), pres(JEFE))); await F(setDoc(INT(bp2, 'S4'), pres(BP2))); await F(setDoc(INT(ger, 'S4'), pres(GER)));
    await F(setDoc(INT(bp1, 'S4'), pres(BP1, { extra: 1 }))); await F(setDoc(INT(bp1, 'S4'), pres(BP1, { monto: 'x'.repeat(61) }))); await F(setDoc(INT(bp1, 'S4'), pres('otro@usil.edu.pe')));
    await F(setDoc(doc(bp1, 'solicitudes', 'S4', 'interno', 'otro'), pres(BP1)));                                       // solo el documento «presupuesto»
    await S(setDoc(INT(bp1, 'S4'), pres(BP1)));
    await S(getDoc(INT(bp1, 'S4'))); await F(getDoc(INT(jefe, 'S4'))); await F(getDoc(INT(jefe2, 'S4'))); await F(getDoc(INT(bp2, 'S4')));
    await F(getDocs(collection(jefe, 'solicitudes', 'S4', 'interno')));
    await F(getDoc(INT(ger, 'S4')));                                                                                     // Gerencia aún no la tiene
  });
  await t('Gerencia lee el monto cuando ya se lo pasaron, pero no lo escribe; con la solicitud cerrada nadie lo cambia', async () => {
    await admin(db => updateDoc(R(db, 'S4'), { estado: 'Enviado a Gerencia', presupuestoConfirmado: 'Sí' }));
    await S(getDoc(INT(ger, 'S4'))); await F(setDoc(INT(ger, 'S4'), pres(GER))); await F(getDoc(INT(jefe, 'S4')));
    await F(setDoc(INT(bp1, 'S4'), pres(BP1, { monto: 'S/ 1' })));                                                       // ya no está en la etapa del HRBP
  });
  await t('el jefe SÍ ve el Sí/No (es un campo de su solicitud) pero eso es todo lo que sabe del presupuesto', async () => {
    const d = (await S(getDoc(R(jefe, 'S1')))).data(); if (d.presupuestoConfirmado !== 'Sí') throw new Error('el jefe debería ver el Sí/No');
    if (JSON.stringify(d).includes('45,000')) throw new Error('el monto no debe estar en la solicitud');
  });
  await t('la gestión del HRBP (solicitud + evento + traza + presupuesto) es UN lote: todo o nada', async () => {
    await S(gestionar(bp1, 'S5', gest(BP1, 'En revisión BP', { comentarioBP: 'Revisando' }), { presupuesto: pres() }));
    const d = (await S(getDoc(R(jefe, 'S5')))).data(); if (d.estado !== 'En revisión BP') throw new Error('no se aplicó');
    await F(gestionar(bp1, 'S5', gest(BP1, 'Devuelto al jefe', { comentarioBP: 'Falta sustento' }), { sufijo: 'x', trazaA: 'En pausa' }));   // la traza no coincide con la solicitud → no pasa nada
    const e = (await S(getDoc(R(jefe, 'S5')))).data(); if (e.estado !== 'En revisión BP') throw new Error('el lote fallido dejó cambios a medias');
    await F(gestionar(bp1, 'S5', gest(BP1, 'En pausa'), { sufijo: 'y', por: 'otro@usil.edu.pe' }));                       // evento firmado por otro
    await F(gestionar(bp2, 'S5', gest(BP2, 'En pausa'), { sufijo: 'z', por: BP2 }));                                      // HRBP ajeno
  });
  await t('el seguimiento del jefe NO lleva correos ni nombres de socios: el evento con «por» no vale como traza', async () => {
    const b = writeBatch(bp1); b.update(R(bp1, 'S5'), gest(BP1, 'Devuelto al jefe', { comentarioBP: 'Falta sustento' })); b.set(doc(bp1, 'trazas', 'TZ-malo'), tz('S5', 'Devuelto al jefe', 'uj', { por: BP1 })); await F(b.commit());
    const c = writeBatch(bp1); c.update(R(bp1, 'S5'), gest(BP1, 'Devuelto al jefe', { comentarioBP: 'Falta sustento' })); c.set(doc(bp1, 'trazas', 'TZ-rol'), tz('S5', 'Devuelto al jefe', 'uj', { rol: 'jefe' })); await F(c.commit());
    const d = writeBatch(bp1); d.update(R(bp1, 'S5'), gest(BP1, 'Devuelto al jefe', { comentarioBP: 'Falta sustento' })); d.set(doc(bp1, 'trazas', 'TZ-uid'), tz('S5', 'Devuelto al jefe', 'uj-ajeno')); await F(d.commit());   // uid que no es el del dueño
    await S(gestionar(bp1, 'S5', gest(BP1, 'Devuelto al jefe', { comentarioBP: 'Falta sustento' }), { sufijo: 'ok' }));
  });
  await t('el jefe lee su seguimiento (y solo el suyo); no lee los eventos con correos; no escribe trazas ni eventos', async () => {
    const mio = await S(getDocs(query(collection(jefe, 'trazas'), where('solicitudId', '==', 'S5'), where('uid', '==', 'uj'))));
    if (mio.size < 2) throw new Error('el jefe debería ver las trazas de su solicitud, vi ' + mio.size);
    mio.docs.forEach(d => { if ('por' in d.data()) throw new Error('la traza del jefe no debe llevar «por»'); });
    await F(getDocs(query(collection(jefe2, 'trazas'), where('solicitudId', '==', 'S5'))));                              // otro jefe
    await F(getDocs(query(collection(jefe, 'trazas'), where('solicitudId', '==', 'S5'))));                               // sin acotar por uid no es demostrable
    await F(getDocs(query(collection(jefe, 'eventos'), where('solicitudId', '==', 'S5')))); await F(getDoc(doc(jefe, 'eventos', 'EV-S5-En revisión BP')));
    await F(setDoc(doc(jefe, 'trazas', 'TZ-jefe'), tz('S5', 'Nuevo', 'uj', { rol: 'bp' }))); await F(setDoc(doc(jefe, 'eventos', 'EV-jefe'), ev('S5', 'Nuevo', JEFE)));
    await F(updateDoc(doc(bp1, 'trazas', 'TZ-S5-En revisión BP'), { comentario: 'x' }));                                  // inmutable
  });
  await t('derivar: el HRBP que la recibe ve TODO el historial (por solicitud); el que la derivó ya no', async () => {
    await admin(db => updateDoc(R(db, 'S5'), { estado: 'En revisión BP' }));
    await S(gestionar(bp1, 'S5', gest(BP1, 'En revisión BP', { bpId: 'bpid-2', derivadoDe: 'bpid-1', comentarioBP: 'Le toca a tu cartera' }), { sufijo: 'der', evento: { tipo: 'Derivación', bpId: 'bpid-2' } }));
    const nuevo = await S(getDocs(query(collection(bp2, 'eventos'), where('solicitudId', '==', 'S5'))));
    if (nuevo.size < 2) throw new Error('el nuevo HRBP debería ver el historial completo, vio ' + nuevo.size);
    await F(getDocs(query(collection(bp1, 'eventos'), where('solicitudId', '==', 'S5'))));
    await S(getDocs(query(collection(bp2, 'eventos'), where('bpId', '==', 'bpid-2'))));                                  // la consulta del panel por bpId sigue valiendo
    await S(getDocs(query(collection(ger, 'eventos'), where('solicitudId', '==', 'S5'))));
  });
  await t('comentarios internos: el HRBP del caso escribe (con su firma y su rol) y Gerencia lo lee; el jefe, otro HRBP y los anónimos no', async () => {
    const com = (id, extra = {}) => ({ solicitudId: 'S2', bpId: 'bpid-1', texto: 'Caso sólido; recomiendo aprobar con el monto indicado.', por: BP1, rol: 'bp', fecha: 'hoy', ...extra });
    const C = (db, id, d) => setDoc(doc(db, 'comentarios', id), d);
    await admin(db => updateDoc(R(db, 'S2'), { estado: 'Enviado a Gerencia' }));                       // S2 ya está con Gerencia
    await S(C(bp1, 'K1', com('K1')));
    await F(C(bp2, 'K2', com('K2', { por: BP2 })));                                                      // otro HRBP
    await F(C(jefe, 'K3', com('K3', { por: JEFE })));                                                    // el jefe no comenta
    await F(C(bp1, 'K4', com('K4', { por: BP2 })));                                                      // firma ajena
    await F(C(bp1, 'K5', com('K5', { texto: '' }))); await F(C(bp1, 'K6', com('K6', { texto: 'x'.repeat(1001) })));
    await F(C(bp1, 'K7', com('K7', { rol: 'gerencia' })));                                               // un HRBP no se hace pasar por Gerencia
    await F(C(bp1, 'K8', com('K8', { bpId: 'bpid-2' }))); await F(C(bp1, 'K9', com('K9', { extra: 1 })));
    await S(C(ger, 'K10', com('K10', { por: GER, rol: 'gerencia', texto: 'Visto. Lo llevo al comité del jueves.' })));    // Gerencia responde un caso que ya le pasaron
    await F(C(ger, 'K11', com('K11', { solicitudId: 'S1', por: GER, rol: 'gerencia' })));               // S1 aún no le llega a Gerencia
    await S(getDocs(query(collection(bp1, 'comentarios'), where('solicitudId', '==', 'S2'))));         // el HRBP del caso
    await S(getDocs(query(collection(bp1, 'comentarios'), where('bpId', '==', 'bpid-1'))));            // lo que carga el panel
    await S(getDocs(collection(ger, 'comentarios')));                                                    // Gerencia los ve todos
    await F(getDocs(query(collection(bp2, 'comentarios'), where('solicitudId', '==', 'S2'))));         // otro HRBP
    await F(getDocs(query(collection(jefe, 'comentarios'), where('solicitudId', '==', 'S2')))); await F(getDoc(doc(jefe, 'comentarios', 'K1')));
    await F(updateDoc(doc(bp1, 'comentarios', 'K1'), { texto: 'editado' }));                             // no se editan
  });
  await env.cleanup();
  console.log('\n' + n + ' pruebas de seguimiento y presupuesto OK');
})().catch(e => { console.error(e); process.exit(1); });

// Carga datos iniciales en Firebase: ruteo, modo prueba, usuarios del panel y (opcional) el Maestro de personal.
// Uso:  cd tools && npm install
//       set GOOGLE_APPLICATION_CREDENTIALS=C:\ruta\clave-de-servicio.json
//       node cargar-datos.js [Maestro_recortado.csv] [--borrar-solicitudes]
// El CSV sale de preparar-maestro.py. La clave de servicio y usuarios.json son secretos: nunca al repositorio (.gitignore ya excluye *.json).
const fs = require("fs"), path = require("path"), crypto = require("crypto"), admin = require("firebase-admin");
const PRUEBA = process.env.DATOS_PRUEBA === "1", SOLO_INVENTADOS = process.env.SOLO_INVENTADOS === "1";   // emuladores: datos inventados, sin personas reales (ver seed-local.js)
admin.initializeApp();
const db = admin.firestore(), norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function csv(texto) {   // CSV con comillas, sin dependencias
  const filas = []; let f = [], c = "", q = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (q) { if (ch === '"') { if (texto[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { f.push(c); c = ""; }
    else if (ch === "\n") { f.push(c); filas.push(f); f = []; c = ""; }
    else if (ch !== "\r") c += ch;
  }
  if (c || f.length) { f.push(c); filas.push(f); }
  return filas;
}
async function lote(items) {   // items: [[ref, data], ...] en tandas de 400
  for (let i = 0; i < items.length; i += 400) { const b = db.batch(); items.slice(i, i + 400).forEach(([r, d]) => b.set(r, d)); await b.commit(); }
}

(async () => {
  const args = process.argv.slice(2), archivo = args.find(a => !a.startsWith("--"));
  // modoPrueba: true solo en los emuladores o con --modo-prueba; en la nube se conserva lo que ya tenía el documento y, si no existe, queda en false.
  // (Antes se escribía true en cada carga: repetirla en producción reabría el Maestro a todos los jefes.) busquedaJefes y accesoAnonimo vuelven siempre a false.
  const previo = (await db.doc("config/app").get()).data() || {};
  await db.doc("config/app").set({ modoPrueba: PRUEBA || args.includes("--modo-prueba") || previo.modoPrueba === true, busquedaJefes: false, accesoAnonimo: false });
  const validos = require("./departamentos"), rf = path.join(__dirname, "ruteo.local.json");
  // En los emuladores, si existen tools/ruteo.local.json y tools/usuarios.json se usan también: así pruebas con tus cuentas reales sin tocar la nube.
  if (!PRUEBA && !fs.existsSync(rf)) throw new Error("Falta tools/ruteo.local.json (ver tools/ruteo.ejemplo.txt)");
  const ruteo = (PRUEBA && (SOLO_INVENTADOS || !fs.existsSync(rf))) ? Object.fromEntries(validos.map(d => [d, { nombre: "HRBP de prueba", correo: "hrbp1@usil.edu.pe" }])) : JSON.parse(fs.readFileSync(rf, "utf8"));
  Object.keys(ruteo).forEach(d => { if (!validos.includes(d)) throw new Error("Departamento desconocido en el ruteo: " + d); });

  const uf = path.join(__dirname, "usuarios.json");
  let usuarios = null; const bpIds = {};
  if (PRUEBA) {   // claves al azar, solo para los emuladores
    const clave = () => crypto.randomBytes(9).toString("base64url");
    usuarios = { "hrbp1@usil.edu.pe": { nombre: "HRBP de prueba", clave: clave(), roles: ["bp"] }, "ger1@usil.edu.pe": { nombre: "Gerencia de prueba", clave: clave(), roles: ["gerencia"] } };
    console.log("Cuentas de prueba del panel:"); Object.entries(usuarios).forEach(([k, v]) => console.log("  " + k + "  clave: " + v.clave));
    if (!SOLO_INVENTADOS && fs.existsSync(uf)) { Object.assign(usuarios, JSON.parse(fs.readFileSync(uf, "utf8"))); console.log("  + las cuentas de tools/usuarios.json (con sus claves)"); }
  } else if (fs.existsSync(uf)) usuarios = JSON.parse(fs.readFileSync(uf, "utf8"));
  if (usuarios) {
    for (const [correo, u] of Object.entries(usuarios)) {
      if (!PRUEBA && u.clave && String(u.clave).length < 12) throw new Error("La clave de " + correo + " debe tener 12 o más caracteres (cámbiala en tools/usuarios.json).");
      const email = norm(correo);
      if (u.clave) try { const x = await admin.auth().getUserByEmail(email); await admin.auth().updateUser(x.uid, { password: u.clave, emailVerified: true }); }
      catch (e) { if (e.code !== "auth/user-not-found") throw e; await admin.auth().createUser({ email, password: u.clave, displayName: u.nombre, emailVerified: true }); }   // emailVerified: las reglas exigen correo verificado
      // Sin clave en usuarios.json: no se crea cuenta; la persona se registra sola con su correo y elige su clave (panel → «Crear mi cuenta»).
      const previo = await db.doc("roles/" + email).get();   // el bpId es aleatorio y se conserva entre cargas
      const bpId = u.roles.includes("bp") ? ((previo.exists && previo.data().bpId) || crypto.randomBytes(12).toString("hex")) : null;
      await db.doc("roles/" + email).set({ nombre: u.nombre, roles: u.roles, pideComoJefe: u.pideComoJefe !== false, ...(bpId ? { bpId } : {}) });   // pideComoJefe: false = no crea solicitudes (socias de negocio)
      if (bpId) { bpIds[email] = bpId; await db.doc("bps/" + bpId).set({ nombre: u.nombre }); }
      if (!PRUEBA) console.log("usuario:", email, u.roles.join("+"));
    }
    // Un socio de negocio sin cuenta con rol (nombre viejo, «HRBP de prueba») no debe aparecer al derivar: nadie vería el caso derivado a él.
    const vivos = new Set((await db.collection("roles").get()).docs.map(d => d.data().bpId).filter(Boolean));
    for (const d of (await db.collection("bps").get()).docs) if (!vivos.has(d.id)) { await d.ref.delete(); console.log("bps huérfano borrado:", d.data().nombre); }
  } else console.log("sin tools/usuarios.json: no se crearon usuarios");

  // Cuentas de prueba de jefes de área (varias, para probar que cada uno ve solo lo suyo; dominios distintos para probar las unidades de USIL).
  // Los jefes reales se registran solos con su correo y confirman con el enlace.
  if (PRUEBA) {
    const compartida = usuarios && Object.values(usuarios).map(u => u.clave).filter(Boolean).pop(), clave = compartida || crypto.randomBytes(9).toString("base64url");   // en pruebas usan la misma clave compartida de usuarios.json
    const jefes = ["jefe1@usil.edu.pe", "jefe2@usil.edu.pe", "jefe3@usil.pe", "jefe4@epg.usil.pe"];
    for (const [i, email] of jefes.entries()) {
      try { const x = await admin.auth().getUserByEmail(email); await admin.auth().updateUser(x.uid, { password: clave, emailVerified: true }); }
      catch (e) { if (e.code !== "auth/user-not-found") throw e; await admin.auth().createUser({ email, password: clave, displayName: "Jefe de prueba " + (i + 1), emailVerified: true }); }
      await db.doc("lideres/" + email).set({ nombre: "JEFE DE PRUEBA " + (i + 1), puesto: "JEFE DE AREA" });
    }
    console.log("Cuentas de prueba de jefes de área:\n  " + jefes.join("\n  ") + "\n  " + (compartida ? "(la clave compartida de usuarios.json)" : "clave: " + clave));
  }

  // Ruteo: solo el identificador opaco del BP (ni nombre ni correo: cualquiera con sesión anónima puede leer este documento)
  await lote(Object.entries(ruteo).map(([dep, bp]) => {
    const id = bpIds[norm(bp.correo)];
    if (!id) throw new Error("El BP del ruteo (" + dep + ") no tiene cuenta con rol bp en usuarios.json: " + bp.correo);
    return [db.doc("ruteo/" + dep), { bpId: id, bpNombre: bp.nombre }];   // el nombre se muestra al jefe para confirmar a quién va su solicitud
  }));
  console.log("ruteo:", Object.keys(ruteo).length, "departamentos");

  if (PRUEBA) {   // personal inventado: 6 por departamento
    const items = []; let n = 0;
    validos.forEach(dep => { for (let i = 1; i <= 6; i++) { const mat = String(++n).padStart(10, "0");
      const ficha = { nombre: "Persona Prueba " + n, puesto: "ANALISTA " + i, situacion: "Activo", departamento: dep, area: "AREA " + i, seccion: "SECCION " + i };
      items.push([db.doc("maestro/" + mat), ficha]);
      items.push([db.doc("colaboradores/" + "persona" + n + "@usil.edu.pe"), { ...ficha, matricula: mat }]); } });   // correos inventados: persona1@…, persona2@…
    await lote(items); console.log("maestro de prueba:", n, "personas inventadas");
  }
  if (archivo) {
    const [cab, ...filas] = csv(fs.readFileSync(archivo, "utf8").replace(/^﻿/, "")).filter(r => r.length > 1);
    if (cab.length !== 8) throw new Error("El CSV debe tener las 8 columnas de preparar-maestro.py");
    const items = [];
    filas.forEach(([mat, nombre, puesto, situacion, departamento, area, seccion, mail]) => {
      if (args.includes("--maestro")) items.push([db.doc("maestro/" + mat), { nombre, puesto, situacion, departamento, area, seccion }]);   // por defecto NO se sube el maestro por matrícula: la búsqueda es solo por correo
      if (mail && /@(usil\.edu\.pe|usil\.pe|epg\.usil\.pe|sir\.pe|sir\.edu\.pe|institutoemprendedores\.pe|institutoemprendedores\.edu\.pe)$/.test(norm(mail))) { items.push([db.doc("lideres/" + norm(mail)), { nombre, puesto }]); items.push([db.doc("colaboradores/" + norm(mail)), { nombre, puesto, situacion, departamento, area, seccion, matricula: mat }]); }
    });
    await lote(items);
    console.log("maestro:", filas.length, "personas");
  }
  // Jefes de área: cuenta con su correo y su documento como clave inicial (tools/jefes-dni.csv, hecho con preparar-jefes.py y fuera del repositorio).
  // Las cuentas que ya existen no se tocan (si alguien ya eligió su clave, se respeta). Firebase guarda solo el hash de la clave.
  const jf = args.find(x => x.startsWith("--jefes="));
  if (jf) {
    const [cab, ...filas] = csv(fs.readFileSync(jf.slice(8), "utf8").replace(/^﻿/, "")).filter(r => r.length > 1);
    if (cab[0] !== "email" || cab[1] !== "documento") throw new Error("El CSV de jefes debe empezar con las columnas email,documento");
    const sinPedir = new Set(Object.entries(usuarios || {}).filter(([, u]) => u.pideComoJefe === false).map(([k]) => norm(k)));   // socias de negocio: sin cuenta de formulario
    const personal = new Set(Object.keys(usuarios || {}).map(norm));   // socios de negocio y Gerencia: su cuenta del formulario es usuario+jefe@… (su cuenta del panel conserva su clave)
    let nuevos = 0, previos = 0, fallos = 0, i = 0;
    const hilo = async () => { while (i < filas.length) { const [mail, doc, nombre] = filas[i++], base = norm(mail), email = personal.has(base) ? base.replace("@", "+jefe@") : base; if (sinPedir.has(base)) continue;
      try { await admin.auth().getUserByEmail(email); previos++; }
      catch (e) { if (e.code !== "auth/user-not-found") { fallos++; continue; }
        try { await admin.auth().createUser({ email, password: doc, displayName: nombre, emailVerified: true }); nuevos++; } catch (x) { fallos++; } } } };
    await Promise.all(Array.from({ length: 12 }, hilo));
    console.log("jefes con cuenta: nuevas", nuevos, "· ya existían", previos, "· con problema", fallos);
  }
  if (args.includes("--borrar-solicitudes")) { await db.recursiveDelete(db.collection("solicitudes")); console.log("solicitudes borradas"); }
})().catch(e => { console.error(e); process.exit(1); });

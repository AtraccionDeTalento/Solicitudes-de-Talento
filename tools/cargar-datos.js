// Carga datos iniciales en Firebase: ruteo, modo prueba, usuarios del panel y (opcional) el Maestro de personal.
// Uso:  cd tools && npm install
//       set GOOGLE_APPLICATION_CREDENTIALS=C:\ruta\clave-de-servicio.json
//       node cargar-datos.js [Maestro_recortado.csv] [--borrar-solicitudes]
// El CSV sale de preparar-maestro.py. La clave de servicio y usuarios.json son secretos: nunca al repositorio (.gitignore ya excluye *.json).
const fs = require("fs"), path = require("path"), crypto = require("crypto"), admin = require("firebase-admin");
const PRUEBA = process.env.DATOS_PRUEBA === "1";   // emuladores: datos inventados, sin personas reales (ver seed-local.js)
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
  await db.doc("config/app").set({ modoPrueba: true });   // en producción: cambiar a false (desde la consola de Firebase)
  const validos = require("./departamentos"), rf = path.join(__dirname, "ruteo.local.json");
  // En los emuladores, si existen tools/ruteo.local.json y tools/usuarios.json se usan también: así pruebas con tus cuentas reales sin tocar la nube.
  if (!PRUEBA && !fs.existsSync(rf)) throw new Error("Falta tools/ruteo.local.json (ver tools/ruteo.ejemplo.txt)");
  const ruteo = (PRUEBA && !fs.existsSync(rf)) ? Object.fromEntries(validos.map(d => [d, { nombre: "HRBP de prueba", correo: "hrbp1@usil.edu.pe" }])) : JSON.parse(fs.readFileSync(rf, "utf8"));
  Object.keys(ruteo).forEach(d => { if (!validos.includes(d)) throw new Error("Departamento desconocido en el ruteo: " + d); });
  await lote(Object.entries(ruteo).map(([dep, bp]) => [db.doc("ruteo/" + dep), bp]));
  console.log("ruteo:", Object.keys(ruteo).length, "departamentos");

  const uf = path.join(__dirname, "usuarios.json");
  let usuarios = null;
  if (PRUEBA) {   // claves al azar, solo para los emuladores
    const clave = () => crypto.randomBytes(9).toString("base64url");
    usuarios = { "hrbp1@usil.edu.pe": { nombre: "HRBP de prueba", clave: clave(), roles: ["bp"] }, "ger1@usil.edu.pe": { nombre: "Gerencia de prueba", clave: clave(), roles: ["gerencia"] } };
    console.log("Cuentas de prueba del panel (solo emulador):"); Object.entries(usuarios).forEach(([k, v]) => console.log("  " + k + "  clave: " + v.clave));
    if (fs.existsSync(uf)) { Object.assign(usuarios, JSON.parse(fs.readFileSync(uf, "utf8"))); console.log("  + las cuentas de tools/usuarios.json (con sus claves)"); }
  } else if (fs.existsSync(uf)) usuarios = JSON.parse(fs.readFileSync(uf, "utf8"));
  if (usuarios) {
    for (const [correo, u] of Object.entries(usuarios)) {
      const email = norm(correo);
      try { const x = await admin.auth().getUserByEmail(email); await admin.auth().updateUser(x.uid, { password: u.clave, emailVerified: true }); }
      catch (e) { if (e.code !== "auth/user-not-found") throw e; await admin.auth().createUser({ email, password: u.clave, displayName: u.nombre, emailVerified: true }); }   // emailVerified: las reglas exigen correo verificado
      await db.doc("roles/" + email).set({ nombre: u.nombre, roles: u.roles });
      if (!PRUEBA) console.log("usuario:", email, u.roles.join("+"));
    }
  } else console.log("sin tools/usuarios.json: no se crearon usuarios");

  if (PRUEBA) {   // personal inventado: 6 por departamento
    const items = []; let n = 0;
    validos.forEach(dep => { for (let i = 1; i <= 6; i++) { const mat = String(++n).padStart(10, "0");
      items.push([db.doc("maestro/" + mat), { nombre: "Persona Prueba " + n, puesto: "ANALISTA " + i, situacion: "Activo", departamento: dep, area: "AREA " + i, seccion: "SECCION " + i }]); } });
    await lote(items); console.log("maestro de prueba:", n, "personas inventadas");
  }
  if (archivo) {
    const [cab, ...filas] = csv(fs.readFileSync(archivo, "utf8").replace(/^﻿/, "")).filter(r => r.length > 1);
    if (cab.length !== 8) throw new Error("El CSV debe tener las 8 columnas de preparar-maestro.py");
    const items = [];
    filas.forEach(([mat, nombre, puesto, situacion, departamento, area, seccion, mail]) => {
      items.push([db.doc("maestro/" + mat), { nombre, puesto, situacion, departamento, area, seccion }]);
      if (mail) items.push([db.doc("lideres/" + norm(mail)), { nombre, puesto }]);
    });
    await lote(items);
    console.log("maestro:", filas.length, "personas");
  }
  if (args.includes("--borrar-solicitudes")) { await db.recursiveDelete(db.collection("solicitudes")); console.log("solicitudes borradas"); }
})().catch(e => { console.error(e); process.exit(1); });

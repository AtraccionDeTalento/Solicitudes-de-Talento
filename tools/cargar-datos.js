// Carga datos iniciales en Firebase: ruteo, modo prueba, usuarios del panel y (opcional) el Maestro de personal.
// Uso:  cd tools && npm install
//       set GOOGLE_APPLICATION_CREDENTIALS=C:\ruta\clave-de-servicio.json
//       node cargar-datos.js [Maestro_recortado.csv] [--borrar-solicitudes]
// El CSV sale de preparar-maestro.py. La clave de servicio y usuarios.json son secretos: nunca al repositorio (.gitignore ya excluye *.json).
const fs = require("fs"), path = require("path"), admin = require("firebase-admin");
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
  const rf = path.join(__dirname, "ruteo.local.json");
  if (!fs.existsSync(rf)) throw new Error("Falta tools/ruteo.local.json (ver tools/ruteo.ejemplo.txt)");
  const ruteo = JSON.parse(fs.readFileSync(rf, "utf8")), validos = require("./departamentos");
  Object.keys(ruteo).forEach(d => { if (!validos.includes(d)) throw new Error("Departamento desconocido en el ruteo: " + d); });
  await lote(Object.entries(ruteo).map(([dep, bp]) => [db.doc("ruteo/" + dep), bp]));
  console.log("ruteo:", Object.keys(ruteo).length, "departamentos");

  const uf = path.join(__dirname, "usuarios.json");
  if (fs.existsSync(uf)) {
    for (const [correo, u] of Object.entries(JSON.parse(fs.readFileSync(uf, "utf8")))) {
      const email = norm(correo);
      try { const x = await admin.auth().getUserByEmail(email); await admin.auth().updateUser(x.uid, { password: u.clave, emailVerified: true }); }
      catch (e) { if (e.code !== "auth/user-not-found") throw e; await admin.auth().createUser({ email, password: u.clave, displayName: u.nombre, emailVerified: true }); }   // emailVerified: las reglas exigen correo verificado
      await db.doc("roles/" + email).set({ nombre: u.nombre, roles: u.roles });
      console.log("usuario:", email, u.roles.join("+"));
    }
  } else console.log("sin tools/usuarios.json: no se crearon usuarios");

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

// Carga datos iniciales en Firebase: ruteo, modo prueba, personas que entran con DNI y el Maestro de personal.
// Uso:  cd tools && npm install
//       set GOOGLE_APPLICATION_CREDENTIALS=C:\ruta\clave-de-servicio.json
//       node cargar-datos.js [Maestro_recortado.csv] [--borrar-solicitudes]
// El CSV sale de preparar-maestro.py (incluye el DNI: bórralo al terminar). La clave de servicio, el CSV y los *.local.json son secretos:
// nunca al repositorio (.gitignore ya los excluye). Los DNI no se guardan: solo se usan para crear cuentas opacas (ver ../dni.mjs).
const fs = require("fs"), path = require("path"), admin = require("firebase-admin");
const PRUEBA = process.env.DATOS_PRUEBA === "1";   // emuladores: datos inventados, sin personas reales (ver seed-local.js)
admin.initializeApp();
const db = admin.firestore(), auth = admin.auth();

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
  const { derivar } = await import("../dni.mjs");
  const args = process.argv.slice(2), archivo = args.find(a => !a.startsWith("--"));
  const validos = require("./departamentos");
  const leer = f => { const p = path.join(__dirname, f); if (!fs.existsSync(p)) throw new Error("Falta tools/" + f + " (ver su archivo .ejemplo.txt)"); return JSON.parse(fs.readFileSync(p, "utf8")); };
  const idDe = async dni => (await derivar(dni)).email;
  /** Crea la cuenta opaca de un DNI (si ya existe, no hace nada: la clave sale del mismo DNI). */
  const cuenta = async dni => {
    const { email, clave } = await derivar(dni);
    try { await auth.createUser({ email, password: clave, emailVerified: true }); }   // emailVerified: las reglas lo exigen
    catch (e) { if (e.code !== "auth/email-already-exists") throw e; }
    return email;
  };

  await db.doc("config/app").set({ modoPrueba: true });   // en producción: cambiar a false (desde la consola de Firebase)

  // ---- Datos de entrada: reales (archivos locales) o de prueba (inventados)
  let ruteo, staff, personas = [];
  if (PRUEBA) {
    ruteo = Object.fromEntries(validos.map(d => [d, { nombre: "HRBP de prueba", dni: "80000001" }]));
    staff = { "80000001": { nombre: "HRBP de prueba", roles: ["bp"] }, "80000002": { nombre: "Gerencia de prueba", roles: ["gerencia"] } };
    let n = 0;
    validos.forEach(dep => { for (let i = 1; i <= 6; i++) { n++; personas.push({ mat: String(n).padStart(10, "0"), dni: String(70000000 + n), nombre: "Persona Prueba " + n, puesto: "ANALISTA " + i, situacion: "Activo", departamento: dep, area: "AREA " + i, seccion: "SECCION " + i }); } });
    console.log("DNI de prueba (solo emulador):  HRBP 80000001  ·  Gerencia 80000002  ·  jefes 70000001 a 70000096");
  } else {
    ruteo = leer("ruteo.local.json"); staff = leer("usuarios.json");
    if (archivo) {
      const [cab, ...filas] = csv(fs.readFileSync(archivo, "utf8").replace(/^﻿/, "")).filter(r => r.length > 1);
      if (cab.length !== 8) throw new Error("El CSV debe tener las 8 columnas de preparar-maestro.py (la última es el DNI)");
      personas = filas.map(([mat, nombre, puesto, situacion, departamento, area, seccion, dni]) => ({ mat, dni, nombre, puesto, situacion, departamento, area, seccion }));
    }
  }
  Object.keys(ruteo).forEach(d => { if (!validos.includes(d)) throw new Error("Departamento desconocido en el ruteo: " + d); });

  // ---- Ruteo: el «correo» del BP es su identificador opaco
  await lote(await Promise.all(Object.entries(ruteo).map(async ([dep, bp]) => [db.doc("ruteo/" + dep), { nombre: bp.nombre, correo: await idDe(bp.dni) }])));
  console.log("ruteo:", Object.keys(ruteo).length, "departamentos");

  // ---- HRBP y Gerencia
  for (const [dni, u] of Object.entries(staff)) {
    const id = await cuenta(dni);
    await db.doc("roles/" + id).set({ nombre: u.nombre, roles: u.roles });
    console.log("acceso al panel:", u.nombre, u.roles.join("+"));
  }

  // ---- Maestro y jefes (todo el personal activo con DNI puede entrar a crear solicitudes)
  if (personas.length) {
    await lote(personas.map(p => [db.doc("maestro/" + p.mat), { nombre: p.nombre, puesto: p.puesto, situacion: p.situacion, departamento: p.departamento, area: p.area, seccion: p.seccion }]));
    const activos = personas.filter(p => p.dni && String(p.situacion).toLowerCase() === "activo");
    for (let i = 0; i < activos.length; i += 25) {
      await Promise.all(activos.slice(i, i + 25).map(async p => { const id = await cuenta(p.dni); await db.doc("lideres/" + id).set({ nombre: p.nombre, puesto: p.puesto }); }));
      if ((i + 25) % 500 === 0) console.log("  cuentas creadas:", i + 25);
    }
    console.log("maestro:", personas.length, "personas · cuentas con DNI:", activos.length);
  }
  if (args.includes("--borrar-solicitudes")) { await db.recursiveDelete(db.collection("solicitudes")); console.log("solicitudes borradas"); }
})().catch(e => { console.error(e); process.exit(1); });

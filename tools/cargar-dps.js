// Carga el catálogo inicial de Descriptivos de puesto desde tools/dps.local.json (lo genera extraer-dps.py). NO sobrescribe lo que ya existe:
// una DP con el mismo código se salta, así una recarga nunca pisa versiones publicadas. Cada carga lleva un lote (loteCarga) para poder deshacerla con --deshacer=<lote>.
// Uso: node tools/cargar-dps.js            (emuladores: npm run seed:dps con npm run emu abierto)
//      node tools/cargar-dps.js --deshacer=<lote>   (borra solo lo cargado en ese lote y que siga en la versión 1)
const fs = require("fs"), path = require("path"), admin = require("firebase-admin");
const EMU = process.argv.includes("--emu");
if (EMU) Object.assign(process.env, { FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080", GCLOUD_PROJECT: "demo-local" });
admin.initializeApp(); const db = admin.firestore();
(async () => {
  const des = process.argv.find(a => a.startsWith("--deshacer="));
  if (des) {
    const lote = des.slice(11), r = await db.collection("dps").where("loteCarga", "==", lote).get(); let n = 0;
    for (const d of r.docs) { if (d.data().version !== 1) { console.log("NO se borra (ya tiene versiones publicadas):", d.id); continue; } await db.recursiveDelete(d.ref); n++; }
    return console.log("deshecho:", n, "DP del lote", lote);
  }
  const f = path.join(__dirname, "dps.local.json"); if (!fs.existsSync(f)) throw new Error("Falta tools/dps.local.json (python tools/extraer-dps.py <archivos .xlsx>)");
  const lote = "carga-" + new Date().toISOString().replace(/\W/g, "").slice(0, 14), ahora = new Date().toISOString(); let nuevas = 0;
  for (const d of JSON.parse(fs.readFileSync(f, "utf8"))) {
    const ref = db.collection("dps").doc(d.codigo);
    if ((await ref.get()).exists) { console.log("ya existe, se respeta:", d.codigo, d.titulo); continue; }
    const v1 = { version: 1, vigencia: ahora.slice(0, 10), datos: d.datos, titulo: d.titulo, publicadoPor: "carga inicial", publicadoEl: ahora, solicitudId: "" };
    const b = db.batch();
    b.set(ref, { codigo: d.codigo, titulo: d.titulo, departamento: d.departamento, estado: "Vigente", loteCarga: lote, ...v1 });
    b.set(ref.collection("versiones").doc("1"), v1); await b.commit(); nuevas++;
    const rt = await db.doc("ruteo/" + d.departamento).get();
    console.log("cargada:", d.codigo, d.titulo, rt.exists ? "" : "· ⚠ el departamento «" + d.departamento + "» no tiene ruteo: nadie podrá pedir cambios hasta agregarlo");
  }
  console.log(nuevas + " DP nuevas · lote " + lote);
})().catch(e => { console.error(e.message); process.exit(1); });

// Carga tools/dps.local.json en Firestore de la nube (dps/{codigo} + versiones/1) usando la sesión de Firebase CLI (sin clave de servicio).
// No pisa: si el documento ya existe, lo salta. Uso: node tools/dps-nube.js
const path = require("path"), fs = require("fs");
const raiz = path.join(__dirname, ".."), FT = p => require(path.join(raiz, "node_modules/firebase-tools/lib", p));
const { requireAuth } = FT("requireAuth"), { Client } = FT("apiv2");
const PROY = "solicitudes-mov-piloto", BASE = `projects/${PROY}/databases/(default)/documents`;

const val = v => v === null || v === undefined ? { nullValue: null }
  : Array.isArray(v) ? { arrayValue: { values: v.map(val) } }
  : typeof v === "object" ? { mapValue: { fields: campos(v) } }
  : typeof v === "number" ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : typeof v === "boolean" ? { booleanValue: v } : { stringValue: String(v) };
const campos = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, val(v)]));

(async () => {
  const { configstore } = FT("configstore");
  await requireAuth({ project: PROY, user: configstore.get("user"), tokens: configstore.get("tokens") });
  const c = new Client({ urlPrefix: "https://firestore.googleapis.com", apiVersion: "v1", auth: true });
  const dps = JSON.parse(fs.readFileSync(path.join(raiz, "tools/dps.local.json"), "utf8"));
  const lote = "carga-" + new Date().toISOString().replace(/\W/g, "").slice(0, 14), ahora = new Date().toISOString();
  let n = 0;
  for (const d of dps) {
    const nombre = `${BASE}/dps/${d.codigo}`;
    const ya = await c.get(`/${nombre}`, { resolveOnHTTPError: true }).then(r => r.status === 200).catch(() => false);
    if (ya) { console.log("ya existe, se respeta:", d.codigo, d.titulo); continue; }
    const v1 = { version: 1, vigencia: ahora.slice(0, 10), datos: d.datos, titulo: d.titulo, publicadoPor: "carga inicial", publicadoEl: ahora, solicitudId: "" };
    await c.post(`/${BASE}:commit`, { writes: [
      { update: { name: nombre, fields: campos({ codigo: d.codigo, titulo: d.titulo, departamento: d.departamento, estado: "Vigente", loteCarga: lote, ...v1 }) }, currentDocument: { exists: false } },
      { update: { name: `${nombre}/versiones/1`, fields: campos(v1) }, currentDocument: { exists: false } }] });
    console.log("cargada:", d.codigo, d.titulo); n++;
  }
  console.log(n + " DP nuevas · lote " + lote);
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });

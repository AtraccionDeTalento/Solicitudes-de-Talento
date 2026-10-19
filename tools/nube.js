// Ayudante para leer/escribir Firestore de la nube con la sesión de Firebase CLI. Uso: node tools/nube.js <comando> [args]
//   listar <colección>            → id y campos (sin valores largos)
const path = require("path");
const raiz = path.join(__dirname, ".."), FT = p => require(path.join(raiz, "node_modules/firebase-tools/lib", p));
const BASE = "projects/solicitudes-mov-piloto/databases/(default)/documents";
const plano = f => { const o = {}; for (const [k, v] of Object.entries(f || {})) o[k] = "stringValue" in v ? v.stringValue : "booleanValue" in v ? v.booleanValue : "integerValue" in v ? Number(v.integerValue) : "arrayValue" in v ? (v.arrayValue.values || []).map(x => x.stringValue ?? JSON.stringify(x)) : "mapValue" in v ? "{…}" : JSON.stringify(v); return o; };
(async () => {
  const { configstore } = FT("configstore");
  await FT("requireAuth").requireAuth({ user: configstore.get("user"), tokens: configstore.get("tokens") });
  const c = new (FT("apiv2").Client)({ urlPrefix: "https://firestore.googleapis.com", apiVersion: "v1", auth: true });
  const [cmd, ...a] = process.argv.slice(2);
  if (cmd === "listar") {
    let token = "", n = 0;
    do {
      const r = await c.get(`/${BASE}/${a[0]}`, { queryParams: { pageSize: "300", ...(token ? { pageToken: token } : {}) } });
      for (const d of r.body.documents || []) { n++; if (!a[1] || n <= Number(a[1])) console.log(d.name.split("/documents/")[1], JSON.stringify(plano(d.fields))); }
      token = r.body.nextPageToken || "";
    } while (token);
    console.log("total:", n);
  }
  if (cmd === "reasignar") {   // reasignar <bpId origen> <bpId destino> <rol a borrar>: mueve sus solicitudes y borra el rol y el bps del origen, en un lote
    const [de, a2, rol] = a, writes = [];
    let token = "";
    do {
      const r = await c.get(`/${BASE}/solicitudes`, { queryParams: { pageSize: "300", ...(token ? { pageToken: token } : {}) } });
      for (const d of r.body.documents || []) if (d.fields.bpId && d.fields.bpId.stringValue === de)
        writes.push({ update: { name: d.name, fields: { bpId: { stringValue: a2 } } }, updateMask: { fieldPaths: ["bpId"] }, currentDocument: { exists: true } });
      token = r.body.nextPageToken || "";
    } while (token);
    const nSol = writes.length;
    writes.push({ delete: `${BASE}/roles/${rol}` }, { delete: `${BASE}/bps/${de}` });
    await c.post(`/${BASE}:commit`, { writes });
    console.log("solicitudes movidas:", nSol, "· borrados roles/" + rol + " y bps/" + de);
  }
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });

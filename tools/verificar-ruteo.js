// Solo emuladores: comprueba que CADA solicitud quedó con el Business Partner que corresponde a su departamento según el ruteo cargado.
Object.assign(process.env, { FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080", GCLOUD_PROJECT: "demo-local" });
const admin = require("firebase-admin"); admin.initializeApp(); const db = admin.firestore();
(async () => {
  const ruteo = Object.fromEntries((await db.collection("ruteo").get()).docs.map(d => [d.id, d.data().bpId]));
  const bps = Object.fromEntries((await db.collection("bps").get()).docs.map(d => [d.id, d.data().nombre]));
  const sol = (await db.collection("solicitudes").get()).docs.map(d => d.data()), mal = [], porBP = {}, deps = new Set();
  sol.forEach(s => { deps.add(s.departamento); const esperado = ruteo[s.departamento]; if (!esperado) mal.push(["sin ruteo", s.id, s.departamento]); else if (s.bpId !== esperado && !s.derivadoDe) mal.push(["BP distinto", s.id, s.departamento, bps[s.bpId], "esperado " + bps[esperado]]); porBP[bps[s.bpId]] = (porBP[bps[s.bpId]] || 0) + 1; });
  console.log("solicitudes:", sol.length, "· departamentos distintos:", deps.size, "· con BP incorrecto:", mal.length); console.log("por socio de negocio:", porBP); mal.slice(0, 5).forEach(m => console.log(m.join(" | ")));
})();

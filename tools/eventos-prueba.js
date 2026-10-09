// Solo emuladores: arma la trazabilidad (colección «eventos») de las solicitudes de prueba según su estado final, con fechas coherentes.
Object.assign(process.env, { FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080", GCLOUD_PROJECT: "demo-local" });
const admin = require("firebase-admin"); admin.initializeApp(); const db = admin.firestore();
let sem = 5; const rnd = () => (sem = (sem * 1664525 + 1013904223) % 4294967296) / 4294967296;
const GER = "ksarmiento@usil.edu.pe";
(async () => {
  const roles = (await db.collection("roles").get()).docs.map(d => d.data()), correoDe = {}; roles.forEach(r => { if (r.bpId) correoDe[r.bpId] = r.correo; });
  // el correo del socio vive en el id del documento de roles
  (await db.collection("roles").get()).docs.forEach(d => { if (d.data().bpId) correoDe[d.data().bpId] = d.id; });
  await db.recursiveDelete(db.collection("eventos"));
  const sols = (await db.collection("solicitudes").get()).docs; let total = 0, lote = db.batch(), en = 0;
  const pon = async (ref, d) => { lote.set(ref, d); total++; if (++en === 400) { await lote.commit(); lote = db.batch(); en = 0; } };
  for (const s of sols) {
    const x = s.data(), inicio = new Date(x.enviadoEl).getTime(), bpMail = correoDe[x.bpId] || "socio@usil.edu.pe", ahora = Date.now();
    let t = inicio, estado = "Nuevo", ultimo = null; const ev = [];
    const paso = (a, por, rol, tipo, comentario) => { t = Math.min(ahora - 36e5, t + (3e5 + rnd() * 2e5) * (1 + rnd() * 400)); ev.push({ solicitudId: s.id, bpId: x.bpId, tipo, de: estado, a, por, rol, fecha: new Date(t).toISOString(), comentario: comentario || "" }); estado = a; ultimo = ev[ev.length - 1]; };
    const fin = x.estado;
    if (x.derivadoDe) paso("En revisión BP", correoDe[x.derivadoDe] || bpMail, "bp", "Derivación", "Derivada por corresponder a otro socio de negocio.");
    if (fin !== "Nuevo") { if (estado === "Nuevo") paso("En revisión BP", bpMail, "bp", "Cambio de estado", "Recibida para revisión."); }
    if (["Devuelto al jefe"].includes(fin)) paso("Devuelto al jefe", bpMail, "bp", "Cambio de estado", x.comentarioBP);
    if (fin === "En pausa") paso("En pausa", bpMail, "bp", "Cambio de estado", "En pausa a la espera de información.");
    if (["Enviado a Gerencia", "Aprobado", "Rechazado"].includes(fin)) {
      if (rnd() < 0.25) { paso("Devuelto al jefe", bpMail, "bp", "Cambio de estado", "Falta sustentar el impacto; corregir y reenviar."); paso("En revisión BP", bpMail, "bp", "Cambio de estado", "El jefe corrigió y reenvió."); }
      paso("Enviado a Gerencia", bpMail, "bp", "Escalada a Gerencia", x.comentarioBP);
      if (["Aprobado", "Rechazado"].includes(fin)) {
        if (rnd() < 0.15) { paso("En revisión BP", GER, "gerencia", "Cambio de estado", "Se devuelve al socio de negocio para ampliar el presupuesto."); paso("Enviado a Gerencia", bpMail, "bp", "Escalada a Gerencia", "Se amplió el sustento y el presupuesto."); }
        paso(fin, GER, "gerencia", "Cambio de estado", x.comentarioGerencia);
      }
    }
    for (const e of ev) await pon(db.collection("eventos").doc(), e);
    if (ultimo) await s.ref.update({ gestionadoPor: ultimo.por, gestionadoEl: ultimo.fecha });
  }
  if (en) await lote.commit();
  console.log(total, "eventos para", sols.length, "solicitudes");
})();

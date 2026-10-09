// Solo emuladores: reparte las solicitudes ya enviadas en estados, puntajes, urgencias y fechas distintos para probar los tableros.
// Las aprobadas puntúan más alto y las rechazadas más bajo; lo resuelto es más antiguo y lo pendiente más reciente.
Object.assign(process.env, { FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080", GCLOUD_PROJECT: "demo-local" });
const admin = require("firebase-admin"); admin.initializeApp(); const db = admin.firestore();
let sem = 11; const rnd = () => (sem = (sem * 1664525 + 1013904223) % 4294967296) / 4294967296, pick = a => a[Math.floor(rnd() * a.length)];
const pesar = pares => { let t = rnd() * pares.reduce((a, p) => a + p[1], 0); for (const [v, w] of pares) { if ((t -= w) < 0) return v; } return pares[0][0]; };
const ESTADOS = [["Enviado a Gerencia", 34], ["Aprobado", 22], ["Rechazado", 12], ["Devuelto al jefe", 12], ["En revisión BP", 10], ["Nuevo", 6], ["En pausa", 4]];
const OBS = ["Falta evidencia del presupuesto aprobado.", "El sustento no explica el cambio de alcance; ampliar con hechos concretos.", "Confirmar el nivel salarial de referencia con Compensaciones.", "Falta la aprobación de la Gerencia del área.", "Indicar la fecha exacta de inicio y el responsable.", "Detallar el impacto económico del movimiento."];
const RECH = ["El comité no ve sustento suficiente para este movimiento.", "Se debe evaluar primero la estructura del área.", "Sin presupuesto en el ejercicio actual.", "Se difiere hasta cerrar el proceso de evaluación de desempeño.", "El puesto puede cubrirse con una movilidad interna."];
const APRO = ["Aprobado por el comité.", "Aprobado; formalizar en la próxima planilla.", "Aprobado con la condición de revisar en seis meses.", "Aprobado según la propuesta del socio de negocio."];
(async () => {
  const docs = (await db.collection("solicitudes").get()).docs; let i = 0;
  for (const d of docs) {
    const estado = pesar(ESTADOS), resuelto = ["Aprobado", "Rechazado"].includes(estado);
    const dias = Math.floor(resuelto ? 25 + rnd() * 335 : rnd() * (estado === "Enviado a Gerencia" ? 170 : 90)), fecha = new Date(Date.now() - dias * 864e5);
    const base = estado === "Aprobado" ? 78 : estado === "Rechazado" ? 52 : 66, puntaje = Math.max(18, Math.min(99, Math.round(base + (rnd() + rnd() + rnd() - 1.5) * 28)));
    const cls = puntaje >= 85 ? "Caso bien preparado" : puntaje >= 60 ? "Caso viable con observaciones" : "Requiere gestión previa";
    const urgencia = pesar([["Inmediato", 26], ["Dentro de 30 días", 32], ["Dentro de 60 días", 24], ["Más adelante", 18]]);
    const cambios = { estado, puntaje: String(puntaje), clasificacion: cls, enviadoEl: fecha.toISOString(), periodo: fecha.toISOString().slice(0, 7), fechaSolicitud: fecha.toISOString().slice(0, 10), urgencia,
      impacto: pesar([["Crítico", 14], ["Alto", 34], ["Medio", 32], ["Bajo", 20]]), presupuesto: pesar([["Sí", 55], ["Por confirmar", 25], ["No", 20]]) };
    if (estado === "Devuelto al jefe") cambios.comentarioBP = pick(OBS);
    if (estado === "Rechazado") { cambios.comentarioGerencia = pick(RECH); cambios.comentarioBP = "Escalado con observaciones menores."; }
    if (estado === "Aprobado") { cambios.comentarioGerencia = pick(APRO); cambios.comentarioBP = "Caso revisado y alineado con la política."; }
    if (estado === "Enviado a Gerencia") cambios.comentarioBP = pick(["Caso revisado y alineado con la política.", "Sustento completo; recomiendo aprobar.", "Escalo con reservas sobre el presupuesto."]);
    await d.ref.update(cambios); i++;
  }
  console.log(i, "solicitudes variadas");
})();

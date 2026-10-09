// Solo emuladores: reparte las solicitudes ya enviadas en estados, puntajes y fechas distintos para probar la vista de Gerencia.
Object.assign(process.env, { FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080", GCLOUD_PROJECT: "demo-local" });
const admin = require("firebase-admin"); admin.initializeApp(); const db = admin.firestore();
let sem = 7; const rnd = () => (sem = (sem * 1664525 + 1013904223) % 4294967296) / 4294967296, pick = a => a[Math.floor(rnd() * a.length)];
const ESTADOS = [["Nuevo", 3], ["En revisión BP", 3], ["En pausa", 1], ["Devuelto al jefe", 3], ["Enviado a Gerencia", 28], ["Aprobado", 17], ["Rechazado", 12]];   // la mayoría llega a Gerencia: es la vista que se prueba
const OBS = ["Falta evidencia del presupuesto aprobado.", "El sustento no explica el cambio de alcance; ampliar con hechos concretos.", "Confirmar el nivel salarial de referencia con Compensaciones.", "Falta la aprobación de la Gerencia del área."];
const RECH = ["El comité no ve sustento suficiente para este movimiento.", "Se debe evaluar primero la estructura del área.", "Sin presupuesto en el ejercicio actual."];
(async () => {
  const docs = (await db.collection("solicitudes").get()).docs; const lista = ESTADOS.flatMap(([e, n]) => Array(n).fill(e));
  while (lista.length < docs.length) lista.push(pick(ESTADOS)[0]);
  let i = 0;
  for (const d of docs) {
    const estado = lista[i++ % lista.length], dias = Math.floor(rnd() * 85), fecha = new Date(Date.now() - dias * 864e5);
    const puntaje = Math.round(35 + rnd() * 63), cls = puntaje >= 85 ? "Caso bien preparado" : puntaje >= 60 ? "Caso viable con observaciones" : "Requiere gestión previa";
    const cambios = { estado, puntaje: String(puntaje), clasificacion: cls, enviadoEl: fecha.toISOString(), periodo: fecha.toISOString().slice(0, 7), fechaSolicitud: fecha.toISOString().slice(0, 10),
      urgencia: pick(["Inmediato", "Dentro de 30 días", "Dentro de 60 días", "Más adelante"]), impacto: pick(["Bajo", "Medio", "Alto", "Crítico"]) };
    if (estado === "Devuelto al jefe") cambios.comentarioBP = pick(OBS);
    if (estado === "Rechazado") { cambios.comentarioGerencia = pick(RECH); cambios.comentarioBP = "Escalado con observaciones menores."; }
    if (estado === "Aprobado") cambios.comentarioGerencia = "Aprobado por el comité.";
    if (["Enviado a Gerencia", "Aprobado", "Rechazado"].includes(estado)) cambios.comentarioBP = cambios.comentarioBP || "Caso revisado y alineado con la política.";
    await d.ref.update(cambios);
  }
  console.log(docs.length, "solicitudes variadas");
})();

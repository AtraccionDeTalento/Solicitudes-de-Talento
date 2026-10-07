// Capa Firebase compartida por index.html y panel.html. La configuración web de Firebase NO es secreta: la seguridad la dan firestore.rules.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth, connectAuthEmulator, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, collection, query, where, limit, getDocs } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "PEGAR",
  authDomain: "PEGAR.firebaseapp.com",
  projectId: "PEGAR",
  appId: "PEGAR"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app), db = getFirestore(app);
// Pruebas locales: http://localhost:PUERTO/index.html?emu usa los emuladores de Firebase en vez del proyecto real.
if (location.hostname === "localhost" && new URLSearchParams(location.search).has("emu")) { connectFirestoreEmulator(db, "127.0.0.1", 8080); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true }); }
export { doc, getDoc, setDoc, updateDoc, collection, query, where, limit, getDocs, signInWithEmailAndPassword, signOut };

/** Correo sin tildes ni ñ y en minúsculas (cmuñozse = cmunozse), como se guarda en Auth y en las reglas. */
export const normalizar = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const esUsil = u => !!u && u.emailVerified && /@usil.edu.pe$/.test(u.email || "");

/** Usuario actual de Firebase (o null). */
export async function usuario() { await auth.authStateReady(); return auth.currentUser; }
/** Jefe con cuenta de Google institucional vigente, o null (los HRBP/Gerencia entran por el panel con correo y clave). */
export async function sesion() { const u = await usuario(); return esUsil(u) && u.providerData.some(p => p.providerId === "google.com") ? u : null; }
export const salir = () => signOut(auth);
export async function entrarGoogle() {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ hd: "usil.edu.pe", prompt: "select_account" });   // «hd» solo sugiere el dominio: lo exigen las reglas
  const { user } = await signInWithPopup(auth, p);
  if (!esUsil(user)) { await signOut(auth); throw new Error("Usa tu cuenta institucional de Google (@usil.edu.pe)."); }
  return user;
}
async function conSesion() { const u = await sesion(); if (!u) throw new Error("Inicia sesión con tu cuenta institucional."); return u; }

const aItem = d => ({ nombre: d.nombre, puesto: d.puesto, situacion: d.situacion, departamento: d.departamento, area: d.area, seccion: d.seccion });

/** Consulta al maestro (misma forma que antes): por matrícula, por correo del líder o una persona activa al azar de un departamento (solo modo prueba). */
export async function maestro(extra) {
  const u = await conSesion();
  if (extra.lider) { const s = await getDoc(doc(db, "lideres", normalizar(u.email))); return s.exists() ? aItem(s.data()) : null; }
  if (extra.aleatorio) {
    const r = await getDocs(query(collection(db, "maestro"), where("departamento", "==", extra.departamento), where("situacion", "==", "Activo"), limit(30)));
    const filas = r.docs.filter(d => d.data().area && d.data().seccion);
    const v = filas.length ? filas : r.docs;
    if (!v.length) return null;
    const d = v[Math.floor(Math.random() * v.length)];
    return { ...aItem(d.data()), codigo: d.id };
  }
  const s = await getDoc(doc(db, "maestro", String(extra.codigo)));
  return s.exists() ? aItem(s.data()) : null;
}

/** Guarda la solicitud. El BP sale del documento «ruteo» del departamento; las reglas verifican que coincida. */
export async function enviar(plano) {
  const u = await conSesion();
  const rt = await getDoc(doc(db, "ruteo", plano.departamento));
  if (!rt.exists()) throw new Error("Departamento sin Business Partner configurado.");
  const bp = rt.data();
  await setDoc(doc(db, "solicitudes", plano.id), { ...plano, enviadoPor: u.email.toLowerCase(), uid: u.uid, bp: bp.nombre, bpCorreo: bp.correo, estado: "Nuevo", comentarioBP: "", comentarioGerencia: "" });
  return { ok: true, bp: bp.nombre };
}

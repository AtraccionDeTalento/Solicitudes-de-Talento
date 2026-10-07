import { derivar } from "./dni.mjs";
// Capa Firebase compartida por index.html y panel.html. La configuración web de Firebase NO es secreta: la seguridad la dan firestore.rules.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, collection, query, where, limit, getDocs } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "PEGAR",
  authDomain: "PEGAR.firebaseapp.com",
  projectId: "PEGAR",
  appId: "PEGAR"
};

// Prueba local: http://localhost:5000/?emu usa los emuladores (proyecto «demo-local»); solo se activa en localhost y nunca toca la nube.
const emu = ["localhost", "127.0.0.1"].includes(location.hostname) && (new URLSearchParams(location.search).has("emu") || sessionStorage.getItem("emu") === "1");
if (emu) sessionStorage.setItem("emu", "1");
const app = initializeApp(emu ? { apiKey: "emulador", authDomain: "localhost", projectId: "demo-local", appId: "emulador" } : firebaseConfig);
export const auth = getAuth(app), db = getFirestore(app);
if (emu) { connectFirestoreEmulator(db, "127.0.0.1", 8080); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true }); }
export { doc, getDoc, setDoc, updateDoc, collection, query, where, limit, getDocs, signOut };
export { derivar, dniValido } from "./dni.mjs";

/** Usuario actual de Firebase (o null). */
export async function usuario() { await auth.authStateReady(); return auth.currentUser; }
export const salir = () => signOut(auth);

/** Perfil de la sesión actual: HRBP/Gerencia (roles/), jefe (lideres/) o null si la cuenta no está autorizada. */
export async function perfil() {
  const u = await usuario(); if (!u || !u.email) return null;
  const r = await getDoc(doc(db, "roles", u.email));
  if (r.exists()) return { rol: "staff", id: u.email, nombre: r.data().nombre, roles: r.data().roles || [] };
  const l = await getDoc(doc(db, "lideres", u.email));
  return l.exists() ? { rol: "jefe", id: u.email, nombre: l.data().nombre, puesto: l.data().puesto } : null;
}

/** Entrada con el DNI. Mismo mensaje para «no existe» y «no autorizado»: no revela quién está en la base. */
export async function entrarDni(dni) {
  const { email, clave } = await derivar(dni);
  try { await signInWithEmailAndPassword(auth, email, clave); } catch (e) { throw new Error("DNI no autorizado."); }
  const p = await perfil();
  if (!p) { await signOut(auth); throw new Error("DNI no autorizado."); }
  return p;
}
async function conSesion() { const p = await perfil(); if (!p) throw new Error("Ingresa con tu DNI."); return p; }

const aItem = d => ({ nombre: d.nombre, puesto: d.puesto, situacion: d.situacion, departamento: d.departamento, area: d.area, seccion: d.seccion });

/** Consulta al maestro (misma forma que antes): por matrícula, por su propio registro de líder o una persona activa al azar de un departamento (solo modo prueba). */
export async function maestro(extra) {
  const u = await conSesion();
  if (extra.lider) { const s = await getDoc(doc(db, "lideres", u.id)); return s.exists() ? aItem(s.data()) : null; }
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
  await setDoc(doc(db, "solicitudes", plano.id), { ...plano, enviadoPor: u.id, uid: (await usuario()).uid, bp: bp.nombre, bpCorreo: bp.correo, estado: "Nuevo", comentarioBP: "", comentarioGerencia: "" });
  return { ok: true, bp: bp.nombre };
}

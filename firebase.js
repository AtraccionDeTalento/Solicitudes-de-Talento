// Capa Firebase compartida por index.html y panel.html. La configuración web de Firebase NO es secreta: la seguridad la dan firestore.rules.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth, connectAuthEmulator, signInAnonymously, signInWithEmailAndPassword, setPersistence, browserSessionPersistence, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, collection, query, where, limit, getDocs } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCtGKE-2MXLRWugP_tcY6TVnwkQ5iyAh18",
  authDomain: "solicitudes-mov-piloto.firebaseapp.com",
  projectId: "solicitudes-mov-piloto",
  appId: "1:609236024055:web:a50ede2cc006520c21f1f2"
};

// Prueba local: en localhost la app usa SIEMPRE los emuladores (proyecto «demo-local») y nunca toca la nube. Para probar localhost contra la nube: ?nube
const emu = ["localhost", "127.0.0.1"].includes(location.hostname) && !new URLSearchParams(location.search).has("nube");
const app = initializeApp(emu ? { apiKey: "emulador", authDomain: "localhost", projectId: "demo-local", appId: "emulador" } : firebaseConfig);
export const auth = getAuth(app), db = getFirestore(app);
if (emu) { connectFirestoreEmulator(db, "127.0.0.1", 8080); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true }); }
export { doc, getDoc, setDoc, updateDoc, collection, query, where, limit, getDocs, signInWithEmailAndPassword, setPersistence, browserSessionPersistence, signOut };

/** Correo sin tildes ni ñ y en minúsculas (una «ñ» se escribe «n»), como se guarda en Auth y en las reglas. */
export const normalizar = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Usuario actual de Firebase (o null). */
export async function usuario() { await auth.authStateReady(); return auth.currentUser; }
/** Jefe con sesión anónima (nombre y correo escritos en la pantalla), o null. HRBP y Gerencia entran por entrarClave. */
export async function sesion() { const u = await usuario(); return u && u.isAnonymous ? u : null; }
/** Entrada del jefe con el correo escrito, sin verificarlo (sesión anónima). Las reglas solo le dejan crear solicitudes y leer las suyas. */
export async function entrarCorreo(email) {
  if (!/^[^@\s]+@usil\.edu\.pe$/i.test(email)) throw new Error("Usa tu correo institucional (@usil.edu.pe).");
  const u = await usuario();
  return u && u.isAnonymous ? u : (await signInAnonymously(auth)).user;
}
export const salir = () => signOut(auth);
/** HRBP o Gerencia con sesión de correo y clave (verificada) o null: van directo al panel. */
export async function personal() {
  const u = await usuario();
  if (!u || !u.emailVerified || !u.providerData.some(p => p.providerId === "password")) return null;
  return (await getDoc(doc(db, "roles", u.email))).exists() ? u : null;   // sin rol asignado no es personal del panel
}
async function conSesion() { const u = await sesion(); if (!u) throw new Error("Inicia sesión con tu cuenta institucional."); return u; }

const aItem = d => ({ nombre: d.nombre, puesto: d.puesto, situacion: d.situacion, departamento: d.departamento, area: d.area, seccion: d.seccion });

/** Consulta al maestro (misma forma que antes): por matrícula, por correo del líder o una persona activa al azar de un departamento (solo modo prueba). */
export async function maestro(extra) {
  const u = await conSesion();
  if (extra.lider) { if (u.isAnonymous) return null; const s = await getDoc(doc(db, "lideres", normalizar(u.email))); return s.exists() ? aItem(s.data()) : null; }
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
  const bpId = rt.data().bpId;
  await setDoc(doc(db, "solicitudes", plano.id), { ...plano, enviadoPor: (u.email || plano.enviadoPor).toLowerCase(), uid: u.uid, bpId, estado: "Nuevo", comentarioBP: "", comentarioGerencia: "" });
  return { ok: true, bp: true };   // el jefe no ve nombres ni correos de los Business Partner
}

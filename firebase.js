// Capa Firebase compartida por index.html y panel.html. La configuración web de Firebase NO es secreta: la seguridad la dan firestore.rules.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth, connectAuthEmulator, signInAnonymously, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
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

/** Usuario actual; los jefes entran como anónimos (solo pueden crear solicitudes y leer las suyas). */
export async function usuario() { await auth.authStateReady(); return auth.currentUser; }
async function anonimo() { return (await usuario()) || (await signInAnonymously(auth)).user; }

const aItem = d => ({ nombre: d.nombre, puesto: d.puesto, situacion: d.situacion, departamento: d.departamento, area: d.area, seccion: d.seccion });

/** Consulta al maestro (misma forma que antes): por matrícula, por correo del líder o una persona activa al azar de un departamento (solo modo prueba). */
export async function maestro(extra, email) {
  await anonimo();
  if (extra.lider) { const s = await getDoc(doc(db, "lideres", normalizar(email))); return s.exists() ? aItem(s.data()) : null; }
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
  const u = await anonimo();
  const rt = await getDoc(doc(db, "ruteo", plano.departamento));
  if (!rt.exists()) throw new Error("Departamento sin Business Partner configurado.");
  const bp = rt.data();
  await setDoc(doc(db, "solicitudes", plano.id), { ...plano, uid: u.uid, bp: bp.nombre, bpCorreo: bp.correo, estado: "Nuevo", comentarioBP: "", comentarioGerencia: "" });
  return { ok: true, bp: bp.nombre };
}

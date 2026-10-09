// Capa Firebase compartida por index.html y panel.html. La configuración web de Firebase NO es secreta: la seguridad la dan firestore.rules.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth, connectAuthEmulator, signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, setPersistence, browserSessionPersistence, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
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
export { doc, getDoc, setDoc, updateDoc, collection, query, where, limit, getDocs, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, setPersistence, browserSessionPersistence, signOut };

/** Correo sin tildes ni ñ y en minúsculas (una «ñ» se escribe «n»), como se guarda en Auth y en las reglas. */
export const normalizar = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Usuario actual de Firebase (o null). */
export async function usuario() { await auth.authStateReady(); return auth.currentUser; }
/** Usuario con correo institucional VERIFICADO y clave (jefe de área o personal con rol), o null. */
export async function sesion() { const u = await usuario(); return u && !u.isAnonymous && u.emailVerified && u.providerData.some(p => p.providerId === "password") ? u : null; }
const esUsil = email => /^[^@\s]+@usil\.edu\.pe$/i.test(email);
/** Entrada con correo institucional y clave. Sin correo verificado no entra. */
export async function entrarJefe(email, clave) {
  if (!esUsil(email)) throw new Error("Usa tu correo institucional (@usil.edu.pe).");
  await setPersistence(auth, browserSessionPersistence);
  let u;
  const intento = async correo => { try { return (await signInWithEmailAndPassword(auth, correo, String(clave))).user; } catch (e) { return null; } };
  email = normalizar(email);
  u = await intento(email);
  // Socio de negocio o Gerencia que también pide como jefe: su cuenta del formulario es «usuario+jefe@…» (clave = su DNI); la del panel conserva la suya.
  if (!u && !/\+/.test(email.split("@")[0])) u = await intento(email.replace("@", "+jefe@"));
  if (!u) throw new Error("Correo o clave incorrectos.");
  if (!u.emailVerified) { await signOut(auth); throw new Error("Falta confirmar tu correo: abre el enlace que te enviamos y vuelve a entrar."); }
  return u;
}
/** Crea la cuenta de un jefe y le envía el enlace para confirmar su correo. Hasta confirmarlo no puede usar la app. */
export async function crearCuenta(email, clave, clave2) {
  email = normalizar(email);
  if (!esUsil(email)) throw new Error("Usa tu correo institucional (@usil.edu.pe).");
  if (String(clave).length < 12) throw new Error("Tu clave debe tener 12 o más caracteres.");
  if (clave !== clave2) throw new Error("Las dos claves no coinciden.");
  let u;
  try { await setPersistence(auth, browserSessionPersistence); u = (await createUserWithEmailAndPassword(auth, email, clave)).user; }
  catch (e) { throw new Error(e.code === "auth/email-already-in-use" ? "Ese correo ya tiene cuenta: entra con tu clave o usa «Olvidé mi clave»." : e.code === "auth/weak-password" ? "Esa clave es demasiado débil." : "No se pudo crear la cuenta. Intenta de nuevo."); }
  try { await sendEmailVerification(u); } finally { await signOut(auth); }
  return "Cuenta creada. Te enviamos un enlace a " + email + ": ábrelo para confirmar tu correo y luego entra con tu clave.";
}
/** Envía el enlace para elegir una clave nueva. Responde igual exista o no la cuenta (no revela quién tiene cuenta). */
export async function olvideClave(email) {
  try { await sendPasswordResetEmail(auth, normalizar(email)); } catch (e) { if (e.code !== "auth/user-not-found" && e.code !== "auth/invalid-email") throw new Error("No se pudo enviar el correo ahora. Intenta más tarde."); }
  return "Si tu correo tiene cuenta, te llegará un enlace para elegir una clave nueva.";
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
  if (extra.lider) { if (u.isAnonymous) return null; const s = await getDoc(doc(db, "lideres", normalizar(u.email).replace(/\+jefe(?=@)/, ""))); return s.exists() ? aItem(s.data()) : null; }
  if (extra.aleatorio) {
    const r = await getDocs(query(collection(db, "maestro"), where("departamento", "==", extra.departamento), where("situacion", "==", "Activo"), limit(30)));
    const filas = r.docs.filter(d => d.data().area && d.data().seccion);
    const v = filas.length ? filas : r.docs;
    if (!v.length) return null;
    const d = v[Math.floor(Math.random() * v.length)];
    return { ...aItem(d.data()), codigo: d.id };
  }
  if (extra.correo) { const s = await getDoc(doc(db, "colaboradores", normalizar(extra.correo))); return s.exists() ? { ...aItem(s.data()), codigo: s.data().matricula } : null; }
  const s = await getDoc(doc(db, "maestro", String(extra.codigo)));
  return s.exists() ? aItem(s.data()) : null;
}

/** Socio de negocio asignado a un departamento (solo el nombre, para que el jefe confirme a quién va su solicitud): texto, "" si no hay nombre o null si el departamento no tiene ruteo. */
export async function socioDe(departamento) {
  if (!departamento) return "";
  const s = await getDoc(doc(db, "ruteo", departamento));
  return s.exists() ? String(s.data().bpNombre || "") : null;
}

/** Guarda la solicitud. El BP sale del documento «ruteo» del departamento; las reglas verifican que coincida. */
export async function enviar(plano) {
  const u = await conSesion();
  const rt = await getDoc(doc(db, "ruteo", plano.departamento));
  if (!rt.exists()) throw new Error("Departamento sin Socio de negocio configurado.");
  const bpId = rt.data().bpId;
  await setDoc(doc(db, "solicitudes", plano.id), { ...plano, enviadoPor: (u.email || plano.enviadoPor).toLowerCase(), uid: u.uid, bpId, estado: "Nuevo", comentarioBP: "", comentarioGerencia: "" });
  return { ok: true, bp: true };   // el jefe no ve nombres ni correos de los Business Partner
}

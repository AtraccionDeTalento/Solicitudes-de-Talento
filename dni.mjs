// Identidad a partir del DNI. El DNI nunca se guarda ni se envía: se convierte en un «correo» y una clave opacos que solo sirven para Firebase Auth.
// Lo usan la página (firebase.js) y el script de carga (tools/cargar-datos.js): una sola fórmula para los dos.
// ponytail: el DNI no es secreto; quien lo conozca entra como esa persona. Para un secreto real hay que sumar una clave o un enlace por correo.
const SAL = "usil-talento-v1";

export async function derivar(dni) {
  const d = String(dni || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  const h = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(SAL + "|" + d)))].map(b => b.toString(16).padStart(2, "0")).join("");
  return { email: h.slice(0, 32) + "@dni.invalid", clave: h.slice(32) };
}

/** 8 dígitos (DNI) o 9 a 12 letras y números (carné de extranjería). */
export const dniValido = dni => /^(\d{8}|[0-9A-Z]{9,12})$/.test(String(dni || "").toUpperCase().replace(/[^0-9A-Z]/g, ""));

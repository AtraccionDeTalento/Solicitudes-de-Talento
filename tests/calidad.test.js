// Prueba del motor de calidad de texto con ejemplos buenos y con basura generada al azar de varias formas.
const assert = require("assert"), { evaluar } = require("../calidad.js");
let ok = 0; const t = (n, f) => { f(); ok++; console.log("  ✓ " + n); };
let semilla = 12345; const rnd = () => (semilla = (semilla * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = a => a[Math.floor(rnd() * a.length)], rep = (n, f) => Array.from({ length: n }, f).join("");

const BUENOS = [
  "El colaborador asumió la coordinación de dos equipos adicionales durante el último semestre y cumplió las metas trimestrales.",
  "Se necesita cubrir la vacante porque la persona anterior renunció y el área no puede sostener la carga de trabajo actual.",
  "La revalorización se debe a que el puesto incorporó la gestión del presupuesto anual y la relación directa con proveedores clave.",
  "Si no se aprueba, existe riesgo de perder a un talento crítico que lidera la implementación del nuevo sistema de admisión.",
  "Cuenta con la aprobación de la Gerencia General por correo del 3 de octubre y con presupuesto asignado en el plan anual.",
  "Reemplaza a María Pérez, quien pasó a otra sede. El puesto mantiene las mismas funciones y el mismo nivel salarial.",
  "Atiende a más de cuarenta clientes corporativos y además capacita a los analistas nuevos del área comercial.",
  "Tiene 12 personas a cargo y reporta directamente al director; el alcance pasó de una sede a tres sedes.",
  "No aplica", "Sí, con evidencia por correo", "Incremento por desempeño sostenido y brecha frente al mercado.",
  "Se requiere de forma inmediata para el inicio del ciclo académico, de lo contrario se retrasan las matrículas.",
];
const MALOS = [
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "asdfghjklñ asdfghjklñ asdfghjklñ", "qwertyuiop zxcvbnm", "hjkhjkhjkhjkhjkhjkhjk", "lorem lorem lorem lorem lorem lorem lorem",
  "xxxxxxxxxx yyyyyyyyyy zzzzzzzzzz", "jajajajajajajajajajajajaja", "123456789012345678901234567890", "........................................", "sdfsdf dfgdfg ghjghj jkljkl",
  "bcdfgh jklmnp qrstvw bcdfgh jklmnp", "ñlkjhgfdsa mnbvcxz poiuytrewq", "ok ok ok ok ok ok ok ok ok ok ok ok", "Esto es una prueba. Esto es una prueba. Esto es una prueba. Esto es una prueba.",
];
t("respuestas reales de distinto estilo se aceptan", () => BUENOS.forEach(s => assert.notStrictEqual(evaluar(s).nivel, "invalido", s)));
t("la mayoría de respuestas reales quedan en «ok»", () => assert.ok(BUENOS.filter(s => evaluar(s).nivel === "ok").length >= BUENOS.length - 2));
t("relleno típico (repeticiones, teclado, símbolos) se rechaza", () => MALOS.forEach(s => assert.notStrictEqual(evaluar(s).nivel, "ok", s)));
t("vacío o solo espacios es inválido", () => { assert.strictEqual(evaluar("").nivel, "invalido"); assert.strictEqual(evaluar("    ").nivel, "invalido"); });
const ALFA = "abcdefghijklmnopqrstuvwxyz";
t("300 cadenas de letras al azar: ninguna llega a «ok» y casi todas son inválidas", () => {
  let inval = 0;
  for (let i = 0; i < 300; i++) { const s = rep(8 + Math.floor(rnd() * 8), () => rep(3 + Math.floor(rnd() * 9), () => pick([...ALFA])) + " ").trim(); const r = evaluar(s); assert.notStrictEqual(r.nivel, "ok", s); if (r.nivel === "invalido") inval++; }
  assert.ok(inval >= 285, "inválidas: " + inval + "/300");
});
t("300 repeticiones de un carácter, pocas letras o una palabra: nunca «ok»", () => {
  for (let i = 0; i < 300; i++) {
    const c = pick([...ALFA]), w = rep(2 + Math.floor(rnd() * 4), () => pick([...ALFA]));
    [rep(10 + Math.floor(rnd() * 40), () => c), rep(6 + Math.floor(rnd() * 10), () => w + " "), rep(8, () => pick(["si ", "no "]))].forEach(s => assert.notStrictEqual(evaluar(s).nivel, "ok", s));
  }
});
t("mezcla de palabras reales sin sentido y sin enlaces no llega a «ok»", () => {
  const P = ["gato", "mesa", "verde", "correr", "luna", "teclado", "nube", "lapiz", "ventana", "cafe", "motor", "playa"];
  for (let i = 0; i < 100; i++) assert.notStrictEqual(evaluar(rep(8, () => pick(P) + " ").trim()).nivel, "ok");
});
t("explica el motivo cuando rechaza", () => { const r = evaluar("AAAAAAAAAAAAAAAAAAAA"); assert.ok(r.motivos.length && r.p < 0.4); });
console.log("\n" + ok + " pruebas de calidad OK");

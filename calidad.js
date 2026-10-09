// Motor de calidad de texto: estima la probabilidad de que una respuesta libre sea prosa real en español
// y no relleno («aaaaaa», «asdfgh», letras al azar, la misma frase repetida). Sin servidor ni IA: reglas + una combinación logística de señales.
// Uso: Calidad.evaluar(texto) -> { p: 0..1, nivel: "ok" | "debil" | "invalido", motivos: [..] }
(function (g) {
  const SIN_TILDE = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const COMUNES = new Set(("de la que el en y a los del se las por un para con no una su al lo como mas pero sus le ya o este si porque esta entre cuando muy sin sobre " +
    "tambien me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto mi antes algunos que unos yo otro otras otra el tanto esa " +
    "estos mucho quienes nada muchos cual poco ella estar estas algunas algo nosotros es son fue ha han ser esta estan sera seria hacer tiene tienen debe deben puesto area equipo " +
    "cargo mayor responsabilidad funciones colaborador persona proceso presupuesto aprobacion resultados impacto negocio cliente").split(/\s+/));
  const TECLADO = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "qazwsxedc", "1234567890", "abcdefghij"];
  const esTeclado = w => { const r = [...w].reverse().join(""); return TECLADO.some(f => { for (let i = 0; i + 4 <= w.length; i++) { const t = w.slice(i, i + 4); if (f.includes(t) || f.includes([...t].reverse().join(""))) return true; } return false; }); };

  function evaluar(texto) {
    const crudo = String(texto || "").trim(), t = SIN_TILDE(crudo), motivos = [];
    if (!crudo) return { p: 0, nivel: "invalido", motivos: ["Está vacío."] };
    const letras = (t.match(/[a-zñ]/g) || []).length, palabras = t.match(/[a-zñ]+/g) || [], n = palabras.length;
    let z = 3;   // sesgo: se parte de «probablemente válido» y cada señal mala resta
    const resta = (v, m) => { z -= v; motivos.push(m); };

    if (letras < crudo.replace(/\s/g, "").length * 0.6) resta(3, "Casi no tiene letras (números o símbolos).");
    if (/(.)\1{3,}/.test(t.replace(/\s/g, " "))) resta(4, "Repite el mismo carácter varias veces seguidas.");
    if (/(\b\w+\b)(\W+\1){2,}/.test(t)) resta(3, "Repite la misma palabra una y otra vez.");

    const unicas = new Set(palabras).size;
    if (n >= 8 && unicas / n < 0.45) resta(2.5, "Repite demasiado las mismas palabras.");
    const frases = crudo.split(/[.!?\n]+/).map(s => SIN_TILDE(s).replace(/\s+/g, " ").trim()).filter(s => s.length > 12);
    if (frases.length >= 2 && new Set(frases).size < frases.length) resta(2.5, "Repite frases completas.");

    const malas = palabras.filter(w => w.length >= 4 && (!/[aeiou]/.test(w) || /[^aeiou]{5,}/.test(w) || /[aeiou]{4,}/.test(w) || esTeclado(w)));
    if (malas.length) resta(Math.min(5, 1.5 + malas.length), "Contiene palabras que no parecen reales.");
    if (palabras.some(w => w.length > 22)) resta(3, "Contiene una «palabra» demasiado larga.");

    if (letras >= 25) {
      const vocales = (t.match(/[aeiou]/g) || []).length / letras;
      if (vocales < 0.25 || vocales > 0.65) resta(2.5, "La proporción de vocales no es la de un texto en español.");
      if (new Set(t.replace(/[^a-zñ]/g, "")).size < 7) resta(3, "Usa muy pocas letras distintas.");
    }
    if (n >= 6) {
      const comunes = palabras.filter(w => COMUNES.has(w)).length / n;
      if (comunes < 0.12) resta(2.5, "No parece una oración en español (faltan palabras de enlace).");
      const largoMedio = letras / n;
      if (largoMedio < 2.2 || largoMedio > 11) resta(2, "El largo de las palabras no es el habitual.");
    } else if (n <= 2 && crudo.length >= 20) resta(2, "Es una sola «palabra» muy larga.");

    const p = 1 / (1 + Math.exp(-z));
    return { p: Math.round(p * 100) / 100, nivel: p >= 0.75 ? "ok" : p >= 0.4 ? "debil" : "invalido", motivos: p >= 0.75 ? [] : motivos };
  }

  const api = { evaluar };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else g.Calidad = api;
})(typeof window !== "undefined" ? window : globalThis);

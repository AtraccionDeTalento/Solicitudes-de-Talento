// Revisor de ortografía y redacción en español, 100 % local: Hunspell (nspell + diccionario es, en assets/) corre en el navegador y el texto nunca sale de él.
// Avisa y sugiere, no bloquea: palabras mal escritas (tildes y letras cambiadas de lugar incluidas), palabras repetidas y mayúscula al iniciar una oración.
(function (raiz) {
  // Palabras del negocio que el diccionario general no conoce.
  const PROPIAS = ["encargatura", "encargaturas", "revalorización", "revalorizaciones", "revalorizar", "organigrama", "organigramas", "headcount", "onboarding", "benchmark", "sobreajuste", "sobreesfuerzo", "sobrecarga", "sobrecargas", "reclutamiento", "upskilling", "reskilling", "feedback", "KPI", "KPIs", "stakeholders", "outsourcing", "freelance", "backoffice", "interinato", "teletrabajo", "capacitaciones", "reestructuración", "reestructuraciones", "reubicación", "reubicaciones", "desvinculación", "desvinculaciones", "homologación", "reclasificación", "nivelación", "contraoferta", "contraofertas", "subvaloración", "sobrevaloración", "escalafón", "autogestión",
    // Vocabulario de Talento, Compensaciones, tecnología y vida universitaria que el diccionario general no trae (todas son palabras válidas en este ámbito):
    "alumni", "antimalware", "benchmarking", "benchmarks", "budget", "ciberseguridad", "cuartil", "cuartiles", "dashboard", "dashboards", "empleabilidad", "entregable", "entregables", "firewall", "firewalls", "forecast", "forecasts", "networking", "vicerrectorado", "vicerrectorados", "workflow", "workflows", "offboarding", "coaching", "mentoring", "headhunter", "headhunters", "headhunting", "assessment", "assessments", "roadmap", "stakeholder", "scorecard", "turnover", "payroll", "outplacement", "staff", "backup", "backups", "hosting", "ransomware", "phishing", "datacenter", "decanatura", "presencialidad", "teletrabajar", "sílabo", "sílabos", "escalabilidad", "interoperabilidad", "fidelización", "replicable", "ingresante", "ingresantes", "proactividad", "headcounts", "presupuestal", "presupuestales"];
  const TILDE = { a: "á", e: "é", i: "í", o: "ó", u: "ú" };
  const mayus = (modelo, w) => (/^\p{Lu}/u.test(modelo) ? w.charAt(0).toUpperCase() + w.slice(1) : w);

  /** Crea el revisor con el motor nspell y los textos .aff/.dic del diccionario. */
  function crear(nspell, aff, dic) {
    const m = nspell(aff, dic);
    PROPIAS.forEach(w => m.add(w));
    // Palabras con prefijo (sobreajuste, sobreesfuerzo, autogestión, reasignar…): valen si lo que sigue al prefijo es una palabra correcta.
    const PREFIJOS = /^(sobre|sub|super|supra|auto|re|pre|pos|post|inter|intra|contra|co|multi|semi|anti|ultra|extra|sin|bi|tri|des)(?=\p{L}{4})/u;
    const base = w => m.correct(w) || m.correct(w.toLowerCase());
    const bien = w => base(w) || (() => { const p = PREFIJOS.exec(w.toLowerCase()); return !!p && base(w.toLowerCase().slice(p[0].length)); })();
    const tildes = w => [...w].flatMap((c, i) => (TILDE[c] ? [w.slice(0, i) + TILDE[c] + w.slice(i + 1)] : []));
    const cambios = w => Array.from({ length: Math.max(0, w.length - 1) }, (_, i) => w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2));   // dos letras seguidas intercambiadas
    const cache = new Map();

    // Primero lo más probable: la misma palabra con tilde, luego letras cambiadas de lugar (con o sin tilde) y al final lo que propone Hunspell.
    function sugerir(w) {
      const b = w.toLowerCase();
      if (cache.has(b)) return cache.get(b);
      const c = [], prueba = x => { if (x !== b && !c.includes(x) && m.correct(x)) c.push(x); };
      tildes(b).forEach(prueba);
      cambios(b).forEach(x => { prueba(x); tildes(x).forEach(prueba); });
      m.suggest(b).forEach(x => { if (!c.includes(x)) c.push(x); });
      const r = c.slice(0, 4);
      cache.set(b, r);
      return r;
    }

    /** Devuelve los problemas de un texto: {tipo, indice, largo, texto, sugerencias}. Cada uno trae su posición exacta. */
    function revisar(t) {
      const out = [], re = /\p{L}[\p{L}'’]*/gu;
      let x, prev = null, sugeridas = 0;
      while ((x = re.exec(t))) {
        const w = x[0], i = x.index, inicio = i === 0 || /[.!?\n]\s*$/.test(t.slice(0, i));
        if (prev && w.length > 1 && prev.w.toLowerCase() === w.toLowerCase() && /^\s+$/.test(t.slice(prev.i + prev.w.length, i)))
          out.push({ tipo: "repetida", indice: prev.i, largo: i + w.length - prev.i, texto: t.slice(prev.i, i + w.length), sugerencias: [prev.w] });
        const ant = prev; prev = { w, i };
        if (inicio && /^\p{Ll}/u.test(w) && w.length === 2 && !(ant && ant.w.length <= 3)) out.push({ tipo: "mayuscula", indice: i, largo: w.length, texto: w, sugerencias: [mayus("A", w)] });   // «el cambio…» tras un punto (no tras «etc.» o «Sr.»)
        if (w.length < 3 || w === w.toUpperCase() || /\p{Ll}\p{Lu}/u.test(w)) continue;   // siglas (HRBP) y mezclas raras: no se tocan
        if (/^\p{Lu}/u.test(w) && !inicio) continue;                                      // nombres propios en medio de la oración
        if (w.toLowerCase() === "mas") { out.push({ tipo: "ortografia", indice: i, largo: w.length, texto: w, sugerencias: [mayus(w, "más")] }); continue; }   // «mas» (= pero) es válida pero en estos textos casi siempre se quiso decir «más»
        if (bien(w)) {
          if (inicio && /^\p{Ll}/u.test(w)) out.push({ tipo: "mayuscula", indice: i, largo: w.length, texto: w, sugerencias: [mayus("A", w)] });
          continue;
        }
        const sug = sugeridas++ < 12 ? sugerir(w).map(s => (inicio ? mayus("A", s) : mayus(w, s))) : [];   // tope: sugerir cuesta, no se hace para cientos de palabras
        out.push({ tipo: "ortografia", indice: i, largo: w.length, texto: w, sugerencias: sug });
      }
      return out;
    }
    return { revisar };
  }

  /** Aplica correcciones al texto (de atrás hacia adelante para no mover posiciones). `elegida` fuerza una sugerencia concreta. */
  function aplicar(t, problemas, elegida) {
    let limite = Infinity;
    [...problemas].sort((a, b) => b.indice - a.indice).forEach(p => {
      const s = elegida != null ? elegida : p.sugerencias[0];
      if (s == null || p.indice + p.largo > limite) return;
      t = t.slice(0, p.indice) + s + t.slice(p.indice + p.largo);
      limite = p.indice;
    });
    return t;
  }

  const api = { crear, aplicar };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  raiz.Ortografia = Object.assign(raiz.Ortografia || {}, api);
  if (typeof document === "undefined") return;

  // ---------- Interfaz: debajo de cada texto largo aparece la lista de sugerencias ----------
  let motor = null, carga = null;
  const iniciar = () => carga || (carga = Promise.all([fetch("assets/es.aff").then(r => r.text()), fetch("assets/es.dic").then(r => r.text())])
    .then(([aff, dic]) => (motor = crear(raiz.nspellLib, aff, dic))).catch(() => null));   // sin diccionario, la app sigue funcionando sin revisor

  const boton = (txt, clase, fn) => { const b = document.createElement("button"); b.type = "button"; b.className = clase; b.textContent = txt; b.onclick = fn; return b; };
  const ETIQUETA = { ortografia: "Ortografía", repetida: "Palabra repetida", mayuscula: "Mayúscula" };

  function pintar(ta) {
    const caja = ta._orto, texto = ta.value;
    caja.textContent = "";
    const r = motor.revisar(texto);
    if (!r.length) { caja.className = "orto" + (texto.trim().length > 20 ? " ok" : ""); caja.textContent = texto.trim().length > 20 ? "✔ Ortografía revisada" : ""; return; }
    const cambiar = nuevo => { ta.value = nuevo; ta.dispatchEvent(new Event("input", { bubbles: true })); pintar(ta); };
    caja.className = "orto aviso";
    const cab = document.createElement("div"); cab.className = "orto-cab";
    const t = document.createElement("b"); t.textContent = `Revisa la redacción (${r.length})`;
    cab.append(t, boton("Corregir todo", "orto-todo", () => cambiar(aplicar(ta.value, r))));
    caja.append(cab);
    const grupos = new Map();
    r.forEach(p => { const k = p.tipo + "|" + p.texto; (grupos.get(k) || grupos.set(k, []).get(k)).push(p); });
    [...grupos.values()].slice(0, 8).forEach(g => {
      const p = g[0], fila = document.createElement("div"); fila.className = "orto-fila";
      const etq = document.createElement("span"); etq.className = "orto-etq"; etq.textContent = ETIQUETA[p.tipo];
      const mal = document.createElement("s"); mal.textContent = p.texto;
      fila.append(etq, mal, " → ");
      if (!p.sugerencias.length) fila.append(Object.assign(document.createElement("em"), { textContent: "sin sugerencia: revísala" }));
      p.sugerencias.forEach(s => fila.append(boton(s || "(quitar)", "orto-sug", () => cambiar(aplicar(ta.value, g, s)))));
      caja.append(fila);
    });
    if (grupos.size > 8) caja.append(Object.assign(document.createElement("div"), { className: "orto-mas", textContent: `…y ${grupos.size - 8} más` }));
  }

  /** Revisa un texto largo (carga el diccionario la primera vez). */
  function revisarCampo(ta) {
    if (!ta || ta.tagName !== "TEXTAREA") return;
    iniciar().then(m => {
      if (!m) return;
      if (!ta._orto) {
        ta.spellcheck = true; ta.lang = "es";
        const caja = ta._orto = document.createElement("div");
        caja.className = "orto"; caja.setAttribute("aria-live", "polite");
        (ta.parentElement.querySelector(".cnt") || ta).insertAdjacentElement("afterend", caja);
        let espera; ta.addEventListener("input", () => { clearTimeout(espera); espera = setTimeout(() => pintar(ta), 900); });
        ta.addEventListener("blur", () => pintar(ta));
      }
      pintar(ta);
    });
  }
  const revisarVisibles = () => document.querySelectorAll(".step.on textarea").forEach(ta => { if (ta.value.trim()) revisarCampo(ta); });
  document.addEventListener("focusin", e => { if (e.target.tagName === "TEXTAREA") revisarCampo(e.target); });
  Object.assign(raiz.Ortografia, { revisarCampo, revisarVisibles });
})(typeof window !== "undefined" ? window : globalThis);

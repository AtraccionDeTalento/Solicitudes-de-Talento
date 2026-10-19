// Descriptivo de puesto (DP) dentro del formulario: panel a la derecha.
// - Colaborador elegido (promoción, reemplazo, encargatura…): se precarga, solo lectura, el DP de su puesto (si está en el catálogo).
// - Puesto nuevo: el jefe arma el DP de la posición (puede partir de uno existente). Se guarda en el campo «dp» de la solicitud (texto JSON).
// El catálogo vive en Firestore (colección dps; la carga tools/cargar-dps.js). ponytail: se empareja por nombre del puesto; con 600+ DP conviene código de puesto.
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const CAMPOS = ["titulo", "mision", "funciones", "reportaA", "supervisaA", "grado", "profesion", "experiencia", "idiomas", "ofimatica", "competencias"];
  let CAT = [], cargado = false, cargando = false, nuevo = { base: "" }, llave = "", recienBase = false;
  function medidor() {   // cuánto del descriptivo nuevo está completo (barra animada)
    const b = $("dpMeterBar"); if (!b) return;
    const n = CAMPOS.filter(k => String(nuevo[k] || "").trim()).length;
    b.style.width = Math.round(n / CAMPOS.length * 100) + "%"; $("dpMeterTxt").textContent = `${n} de ${CAMPOS.length} secciones completas`;
  }

  async function cargar() {
    if (cargado || cargando) return; cargando = true;
    try { const fb = await FBp; CAT = await fb.dps(); cargado = true; } catch (e) { CAT = []; }   // sin sesión aún: se reintenta en el siguiente render
    cargando = false; llave = ""; DPF.render();
  }

  const lis = a => (a || []).filter(Boolean).map(x => `<li>${esc(x)}</li>`).join("");
  const niv = a => (a || []).filter(x => x.nombre).map(x => x.nombre + (x.nivel ? ` (${x.nivel})` : ""));
  const sec = (t, h) => h ? `<details open><summary>${esc(t)}</summary>${h}</details>` : "";
  function tarjeta(d) {
    const e = d.educacion || {}, c = d.competencias || {};
    const comp = [...niv(c.transversales), ...niv(c.lideres), ...niv(c.adicionales)];
    return `<span class="dpBadge ok">✓ Descriptivo encontrado</span><h4>${esc(d.titulo)}</h4><p class="dpm">${esc([d.departamento, d.area, d.seccion].filter(Boolean).join(" · "))}</p>
      <p class="dpm"><b>Reporta a:</b> ${esc(d.reportaA || "—")} · <b>Supervisa a:</b> ${esc(d.supervisaA || "—")}</p>
      ${sec("Misión", d.mision ? `<p>${esc(d.mision)}</p>` : "")}${sec("Funciones", d.funciones && d.funciones.length ? `<ul>${lis(d.funciones)}</ul>` : "")}
      ${sec("Formación y experiencia", `<ul>${lis([e.grado && "Grado: " + e.grado, e.profesion && "Profesión: " + e.profesion, e.especializaciones && "Especialización: " + e.especializaciones, e.experienciaMinPuesto && "Experiencia mínima: " + e.experienciaMinPuesto])}</ul>`)}
      ${sec("Idiomas y ofimática", `<ul>${lis([...niv(d.idiomas), ...niv(d.ofimatica)])}</ul>`)}${sec("Competencias", comp.length ? `<ul>${lis(comp)}</ul>` : "")}`;
  }

  function constructor() {
    const o = CAT.map(x => `<option value="${esc(x.id)}"${nuevo.base === x.id ? " selected" : ""}>${esc(x.titulo)}</option>`).join("");
    const t = (k, l, ph = "") => `<label>${l}<input data-dp="${k}" value="${esc(nuevo[k] || "")}" placeholder="${esc(ph)}" maxlength="150"></label>`;
    const a = (k, l, ph = "") => `<label>${l}<textarea data-dp="${k}" rows="4" maxlength="2500" placeholder="${esc(ph)}">${esc(nuevo[k] || "")}</textarea></label>`;
    return `<span class="dpBadge nuevo">Puesto nuevo</span><h4>Descriptivo del puesto nuevo</h4><p class="dpm">Arma el descriptivo de la posición que solicitas. Puedes partir de uno existente y ajustarlo.</p>
      <div class="dpMeter" aria-hidden="true"><i id="dpMeterBar"></i></div><p class="dpm" id="dpMeterTxt"></p>
      <label>Partir de un descriptivo existente<select id="dpBase"><option value="">— Empezar en blanco —</option>${o}</select></label>
      ${t("titulo", "Nombre del puesto")}${a("mision", "Misión del puesto", "¿Para qué existe el puesto?")}${a("funciones", "Funciones principales (una por línea)")}
      ${t("reportaA", "Reporta a")}${t("supervisaA", "Supervisa a", "Ej.: Ninguno")}${t("grado", "Grado académico mínimo", "Ej.: Bachiller")}${t("profesion", "Profesiones afines")}${t("experiencia", "Experiencia mínima", "Ej.: 2 años")}
      ${t("idiomas", "Idiomas y nivel", "Ej.: Inglés intermedio")}${t("ofimatica", "Ofimática y nivel", "Ej.: Excel intermedio")}${a("competencias", "Competencias (una por línea)")}`;
  }

  function desde(d) {   // DP del catálogo → campos del constructor
    const e = d.educacion || {}, c = d.competencias || {};
    return { titulo: "", mision: d.mision || "", funciones: (d.funciones || []).join("\n"), reportaA: d.reportaA || "", supervisaA: d.supervisaA || "", grado: e.grado || "", profesion: e.profesion || "", experiencia: e.experienciaMinPuesto || "",
      idiomas: niv(d.idiomas).join(", "), ofimatica: niv(d.ofimatica).join(", "), competencias: [...niv(c.transversales), ...niv(c.lideres), ...niv(c.adicionales)].join("\n") };
  }

  const DPF = window.DPF = {
    reset() { nuevo = { base: "" }; llave = ""; },
    /** Texto JSON que viaja con la solicitud ("" si no hay nada). */
    json() {
      const mov = $("movimiento").value;
      if (mov === "Puesto nuevo") return CAMPOS.some(k => nuevo[k]) ? JSON.stringify({ modo: "nuevo", ...nuevo }).slice(0, 7500) : "";
      const p = coincide(); return p ? JSON.stringify({ modo: "existente", codigo: p.id, titulo: p.titulo }) : "";
    },
    cargar(txt) {
      nuevo = { base: "" };
      try { const o = JSON.parse(txt || "{}"); if (o.modo === "nuevo") nuevo = o; } catch (e) { /* borrador sin DP */ }
      llave = ""; DPF.render();
    },
    render() {
      const box = $("dpPanel"); if (!box) return;
      if (!cargado && !cargando && SESSION) cargar();
      const paso = typeof cur === "number" ? cur : 0, mov = $("movimiento").value, puesto = $("puestoActual").value;
      const ver = paso <= 1 && !!mov;
      $("dpCols").classList.toggle("conDp", ver); box.classList.toggle("hidden", !ver);
      if (!ver) return;
      const p = mov === "Puesto nuevo" ? null : coincide();
      const k = [mov, puesto, p && p.id, CAT.length, mov === "Puesto nuevo" ? nuevo.base : ""].join("|");
      if (k === llave) return;   // no se redibuja mientras escribe en el constructor
      llave = k;
      const skel = '<div class="dpSkel" style="width:70%"></div><div class="dpSkel"></div><div class="dpSkel" style="width:85%"></div><div class="dpSkel" style="width:60%"></div>';
      box.innerHTML = `<div class="dpHead">Descriptivo de puesto</div><div class="dpBody">` + (mov === "Puesto nuevo" ? constructor()
        : !cargado && puesto ? skel
        : p ? tarjeta(p.datos || p) + `<p class="dpm">Fuente: catálogo de descriptivos (${esc(p.id)}).</p>`
        : puesto && puesto !== "No aplica" ? `<span class="dpBadge no">Sin descriptivo cargado</span><p class="dpm">Aún no hay descriptivo cargado para «${esc(puesto)}».</p>` : `<p class="dpm">Elige al colaborador para ver el descriptivo de su puesto.</p>`) + `</div>`;
      if (mov === "Puesto nuevo") { medidor(); if (recienBase) box.querySelectorAll("[data-dp]").forEach(el => { if (el.value) el.classList.add("flash"); }); }
      recienBase = false;
    }
  };
  function coincide() { const n = norm($("puestoActual").value); return n ? CAT.find(x => norm(x.titulo) === n) || null : null; }

  document.addEventListener("input", e => { const k = e.target.dataset && e.target.dataset.dp; if (k) { nuevo[k] = e.target.value; medidor(); document.getElementById("form").dispatchEvent(new Event("input")); } });
  document.addEventListener("change", e => {
    if (e.target.id !== "dpBase") return;
    const x = CAT.find(c => c.id === e.target.value); nuevo = x ? { base: x.id, ...desde(x.datos || x) } : { base: "" };
    llave = ""; recienBase = !!x; DPF.render(); document.getElementById("form").dispatchEvent(new Event("input"));
  });
})();

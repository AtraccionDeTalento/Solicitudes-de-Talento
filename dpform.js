// Descriptivo de puesto (DP) dentro del formulario: panel a la derecha que se amplía en una ventana central (fondo difuminado) para leer o editar.
// - Colaborador elegido (promoción, reemplazo, encargatura…): se precarga el DP de su puesto (si está en el catálogo); en la ventana se pueden proponer ajustes.
// - Puesto nuevo: el jefe arma el DP de la posición (puede partir de uno existente).
// Lo que arma o ajusta viaja en el campo «dp» de la solicitud (texto JSON). El catálogo vive en Firestore (colección dps; la carga tools/cargar-dps.js).
// ponytail: se empareja por nombre del puesto; con 600+ DP conviene código de puesto.
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const CAMPOS = ["titulo", "mision", "funciones", "reportaA", "supervisaA", "grado", "profesion", "experiencia", "idiomas", "ofimatica", "competencias"];
  let CAT = [], cargado = false, cargando = false, nuevo = { base: "" }, llave = "", recienBase = false, ajuste = null;   // ajuste = código del DP existente que el jefe propone ajustar

  async function cargar() {
    if (cargado || cargando) return; cargando = true;
    try { const fb = await FBp; CAT = await fb.dps(); cargado = true; } catch (e) { CAT = []; }
    let dl = $("dpTitulos"); if (!dl) { dl = document.createElement("datalist"); dl.id = "dpTitulos"; document.body.appendChild(dl); }   // sugerencias de puesto en las preguntas (promoción, encargatura)
    dl.innerHTML = CAT.map(x => `<option value="${esc(x.titulo)}">`).join("");   // sin sesión aún: se reintenta en el siguiente render
    cargando = false; llave = ""; DPF.render();
  }
  function medidor() {   // cuánto del descriptivo está completo (barra animada)
    const n = CAMPOS.filter(k => String(nuevo[k] || "").trim()).length, pct = Math.round(n / CAMPOS.length * 100) + "%";
    document.querySelectorAll(".dpMeter i").forEach(b => b.style.width = pct);
    document.querySelectorAll(".dpMeterTxt").forEach(t => t.textContent = `${n} de ${CAMPOS.length} secciones completas`);
  }

  const lis = a => (a || []).filter(Boolean).map(x => `<li>${esc(x)}</li>`).join("");
  const niv = a => (a || []).filter(x => x.nombre).map(x => x.nombre + (x.nivel ? ` (${x.nivel})` : ""));
  const sec = (t, h) => h ? `<details open><summary>${esc(t)}</summary>${h}</details>` : "";
  function tarjeta(d) {
    const e = d.educacion || {}, c = d.competencias || {};
    const comp = [...niv(c.transversales), ...niv(c.lideres), ...niv(c.adicionales)];
    return `<h4>${esc(d.titulo)}</h4><p class="dpm">${esc([d.departamento, d.area, d.seccion].filter(Boolean).join(" · "))}</p>
      <p class="dpm"><b>Reporta a:</b> ${esc(d.reportaA || "—")} · <b>Supervisa a:</b> ${esc(d.supervisaA || "—")}</p>
      ${sec("Misión", d.mision ? `<p>${esc(d.mision)}</p>` : "")}${sec("Funciones", d.funciones && d.funciones.length ? `<ul>${lis(d.funciones)}</ul>` : "")}
      ${sec("Formación y experiencia", `<ul>${lis([e.grado && "Grado: " + e.grado, e.profesion && "Profesión: " + e.profesion, e.especializaciones && "Especialización: " + e.especializaciones, e.experienciaMinPuesto && "Experiencia mínima: " + e.experienciaMinPuesto])}</ul>`)}
      ${sec("Idiomas y ofimática", `<ul>${lis([...niv(d.idiomas), ...niv(d.ofimatica)])}</ul>`)}${sec("Competencias", comp.length ? `<ul>${lis(comp)}</ul>` : "")}`;
  }

  function editor(conBase) {
    const o = CAT.map(x => `<option value="${esc(x.id)}"${nuevo.base === x.id ? " selected" : ""}>${esc(x.titulo)}</option>`).join("");
    const t = (k, l, ph = "") => `<label>${l}<input data-dp="${k}" value="${esc(nuevo[k] || "")}" placeholder="${esc(ph)}" maxlength="150"></label>`;
    const a = (k, l, ph = "") => `<label class="ancho">${l}<textarea data-dp="${k}" rows="4" maxlength="2500" placeholder="${esc(ph)}">${esc(nuevo[k] || "")}</textarea></label>`;
    return `<div class="dpMeter" aria-hidden="true"><i></i></div><p class="dpm dpMeterTxt"></p>
      <div class="dpCampos">${conBase ? `<label class="ancho">Partir de un descriptivo existente<select id="dpBase"><option value="">— Empezar en blanco —</option>${o}</select></label>` : ""}
      ${t("titulo", "Nombre del puesto")}${t("reportaA", "Reporta a")}${a("mision", "Misión del puesto", "¿Para qué existe el puesto?")}${a("funciones", "Funciones principales (una por línea)")}
      ${t("supervisaA", "Supervisa a", "Ej.: Ninguno")}${t("grado", "Grado académico mínimo", "Ej.: Bachiller")}${t("profesion", "Profesiones afines")}${t("experiencia", "Experiencia mínima", "Ej.: 2 años")}
      ${t("idiomas", "Idiomas y nivel", "Ej.: Inglés intermedio")}${t("ofimatica", "Ofimática y nivel", "Ej.: Excel intermedio")}${a("competencias", "Competencias (una por línea)")}</div>`;
  }

  function desde(d) {   // DP del catálogo → campos del editor
    const e = d.educacion || {}, c = d.competencias || {};
    return { titulo: "", mision: d.mision || "", funciones: (d.funciones || []).join("\n"), reportaA: d.reportaA || "", supervisaA: d.supervisaA || "", grado: e.grado || "", profesion: e.profesion || "", experiencia: e.experienciaMinPuesto || "",
      idiomas: niv(d.idiomas).join(", "), ofimatica: niv(d.ofimatica).join(", "), competencias: [...niv(c.transversales), ...niv(c.lideres), ...niv(c.adicionales)].join("\n") };
  }
  // Qué descriptivo corresponde según el movimiento: el del puesto al que va (promoción, encargatura, movimiento interno) o, si no, el del puesto actual / el que queda vacante.
  const OBJ = { "Promoción": ["puestoPropuesto", "Puesto propuesto"], "Movimiento interno": ["puestoDestino", "Puesto destino"], "Encargatura": ["puestoEncargado", "Posición a cubrir"] };
  const objetivo = () => { const o = OBJ[$("movimiento").value], el = o && $(o[0]); return el && el.value.trim() ? [el.value, o[1]] : null; };
  function coincide() {
    const cand = [objetivo(), [$("puestoActual").value, $("movimiento").value === "Reemplazo" ? "Puesto a cubrir" : "Puesto actual"]].filter(Boolean);
    for (const [t, origen] of cand) { const n = norm(t); if (!n) continue; const x = CAT.find(c => norm(c.titulo) === n) || (origen !== "Puesto actual" && origen !== "Puesto a cubrir" ? CAT.find(c => n.includes(norm(c.titulo))) : null); if (x) return { ...x, origen }; }
    return null;
  }
  const esNuevo = () => $("movimiento").value === "Puesto nuevo";

  // ---------- Ventana ampliada ----------
  function dlg() {
    let d = $("dpDialog");
    if (!d) {
      d = document.createElement("dialog"); d.id = "dpDialog"; d.setAttribute("aria-label", "Descriptivo de puesto");
      d.innerHTML = `<div class="dpDlgHead"><span>Descriptivo de puesto</span><button type="button" class="dpClose">Listo</button></div><div class="dpDlgBody"></div>`;
      document.body.appendChild(d);
      d.addEventListener("click", e => {
        if (e.target === d || e.target.closest(".dpClose")) return cerrar();
        if (e.target.closest("[data-dpaccion=ajustar]")) { const p = coincide(); if (p) { ajuste = p.id; nuevo = { base: p.id, ...desde(p.datos || p), titulo: p.titulo }; pintarDlg(); document.getElementById("form").dispatchEvent(new Event("input")); } }
      });
      d.addEventListener("cancel", e => { e.preventDefault(); cerrar(); });
    }
    return d;
  }
  function pintarDlg() {
    const p = esNuevo() ? null : coincide(), body = dlg().querySelector(".dpDlgBody");
    body.innerHTML = `<div class="dpBody">` + (esNuevo() ? `<span class="dpBadge nuevo">Puesto nuevo</span><h4>Descriptivo del puesto nuevo</h4><p class="dpm">Flujo del descriptivo: Jefe → Socio de negocio (HRBP) → Compensaciones → Publicación.</p>${editor(true)}`
      : ajuste && p ? `<span class="dpBadge nuevo">Ajustes propuestos</span><h4>${esc(p.titulo)}</h4><p class="dpm">Cambia lo que corresponda. Este cambio sigue su propio flujo: Jefe → Socio de negocio (HRBP) → Compensaciones → Publicación.</p>${editor(false)}`
      : p ? `<span class="dpBadge ok">✓ Descriptivo encontrado</span><div class="dpLectura">${tarjeta(p.datos || p)}</div><div class="dpAcciones"><button type="button" class="secondary" data-dpaccion="ajustar">Proponer ajustes a este descriptivo</button></div>`
      : `<p class="dpm">Aún no hay descriptivo para este puesto.</p>`) + `</div>`;
    medidor();
  }
  function abrir() { const d = dlg(); pintarDlg(); if (!d.open) d.showModal(); }
  function cerrar() { const d = dlg(); if (!d.open) return; d.classList.add("saliendo"); setTimeout(() => { d.classList.remove("saliendo"); d.close(); llave = ""; DPF.render(); }, 180); }

  const DPF = window.DPF = {
    reset() { nuevo = { base: "" }; ajuste = null; llave = ""; },
    /** Texto JSON que viaja con la solicitud ("" si no hay nada). */
    json() {
      if (esNuevo()) return CAMPOS.some(k => nuevo[k]) ? JSON.stringify({ modo: "nuevo", ...nuevo }).slice(0, 7500) : "";
      const p = coincide(); if (!p) return "";
      return ajuste === p.id ? JSON.stringify({ modo: "ajuste", codigo: p.id, ...nuevo }).slice(0, 7500) : JSON.stringify({ modo: "existente", codigo: p.id, titulo: p.titulo });
    },
    cargar(txt) {
      nuevo = { base: "" }; ajuste = null;
      try { const o = JSON.parse(txt || "{}"); if (o.modo === "nuevo") nuevo = o; if (o.modo === "ajuste") { nuevo = o; ajuste = o.codigo; } } catch (e) { /* borrador sin DP */ }
      llave = ""; DPF.render();
    },
    render() {
      const box = $("dpPanel"); if (!box) return;
      if (!cargado && !cargando && SESSION) cargar();
      const paso = typeof cur === "number" ? cur : 0, mov = $("movimiento").value, puesto = $("puestoActual").value;
      const ver = paso <= 1 && !!mov;
      $("dpCols").classList.toggle("conDp", ver); box.classList.toggle("hidden", !ver);
      if (!ver) return;
      const p = esNuevo() ? null : coincide();
      if (ajuste && cargado && (!p || p.id !== ajuste)) { ajuste = null; nuevo = { base: "" }; }   // cambió el colaborador: el ajuste era de otro puesto
      const ob = objetivo(), k = [mov, puesto, ob && ob[0], p && p.id, CAT.length, esNuevo() ? nuevo.base : "", ajuste].join("|");
      if (k === llave) return;   // no se redibuja mientras escribe
      llave = k;
      const skel = '<div class="dpSkel" style="width:70%"></div><div class="dpSkel"></div><div class="dpSkel" style="width:85%"></div><div class="dpSkel" style="width:60%"></div>';
      const ampliar = `<button type="button" class="dpExpand" data-dpaccion="abrir">Ampliar vista del descriptivo de puesto ⤢</button>`;
      box.innerHTML = `<div class="dpHead"><span>Descriptivo de puesto</span>${(esNuevo() || p) ? ampliar : ""}</div><div class="dpBody">` + (esNuevo()
          ? `<span class="dpBadge nuevo">Puesto nuevo</span><h4>Descriptivo del puesto nuevo</h4><p class="dpm">Arma el descriptivo de la posición. Puedes partir de uno existente.</p>${editor(true)}`
        : !cargado && puesto ? skel
        : p ? `<span class="dpBadge ${ajuste ? "nuevo" : "ok"}">${ajuste ? "Ajustes propuestos" : "✓ Descriptivo encontrado"}</span><p class="dpm">Mostrando: ${esc(p.origen)}</p><div class="dpClick" data-dpaccion="abrir" title="Ampliar">${tarjeta(p.datos || p)}</div><p class="dpm">Fuente: catálogo de descriptivos (${esc(p.id)}).</p>`
        : (ob || (puesto && puesto !== "No aplica")) ? `<span class="dpBadge no">Sin descriptivo cargado</span><p class="dpm">Aún no hay descriptivo cargado para «${esc(ob ? ob[0] : puesto)}».</p>` : `<p class="dpm">Elige al colaborador para ver el descriptivo de su puesto.</p>`) + `</div>`;
      if (esNuevo()) { medidor(); if (recienBase) document.querySelectorAll("[data-dp]").forEach(el => { if (el.value) el.classList.add("flash"); }); }
      recienBase = false;
    }
  };

  document.addEventListener("click", e => { const a = e.target.closest("#dpPanel [data-dpaccion=abrir]"); if (a && !e.target.closest("summary")) abrir(); });
  // Apenas el jefe toca un campo del panel, el descriptivo se amplía y sigue escribiendo en la ventana grande, en el mismo campo.
  document.addEventListener("focusin", e => {
    const el = e.target.closest("#dpPanel [data-dp], #dpPanel #dpBase"); if (!el) return;
    el.blur(); abrir();
    const d = $("dpDialog"), dest = el.id === "dpBase" ? d.querySelector("#dpBase") : d.querySelector(`[data-dp="${el.dataset.dp}"]`);
    if (dest) setTimeout(() => dest.focus(), 60);
  });
  document.addEventListener("input", e => {
    const k = e.target.dataset && e.target.dataset.dp; if (!k) return;
    nuevo[k] = e.target.value; medidor();
    document.querySelectorAll(`[data-dp="${k}"]`).forEach(el => { if (el !== e.target) el.value = e.target.value; });   // panel y ventana muestran lo mismo
    document.getElementById("form").dispatchEvent(new Event("input"));
  });
  document.addEventListener("change", e => {
    if (e.target.id !== "dpBase") return;
    const x = CAT.find(c => c.id === e.target.value); nuevo = x ? { base: x.id, ...desde(x.datos || x) } : { base: "" };
    llave = ""; recienBase = !!x; DPF.render(); if ($("dpDialog") && $("dpDialog").open) pintarDlg();
    document.getElementById("form").dispatchEvent(new Event("input"));
  });
})();

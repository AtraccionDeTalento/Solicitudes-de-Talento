import * as FB from "./firebase.js";
// Panel de HRBP y Gerencia sobre Firestore. Las reglas (firestore.rules) deciden qué ve y qué cambia cada rol; aquí solo se consulta.
const VISIBLE_GER=["Enviado a Gerencia","Aprobado","Rechazado"];
const CFG={bp:{estados:["En revisión BP","Devuelto al jefe","Enviado a Gerencia","En pausa"],editables:["Nuevo","En revisión BP","Devuelto al jefe","En pausa"],campo:"comentarioBP"},
  gerencia:{estados:["Enviado a Gerencia","Aprobado","Rechazado","En revisión BP"],editables:VISIBLE_GER,campo:"comentarioGerencia"}};
const sesion=async()=>{
  const u=await FB.usuario();if(!u||!u.providerData.some(x=>x.providerId==="password"))throw new Error("Inicia sesión");
  const s=await FB.getDoc(FB.doc(FB.db,"roles",u.email));const vistas=s.exists()?(s.data().roles||[]).filter(r=>CFG[r]):[];
  if(!vistas.length){await FB.signOut(FB.auth);throw new Error("Tu cuenta no tiene un rol asignado.")}
  return {token:"fb",email:u.email,vistas};
};
const SIN=new Set(["levantamiento","aprobaciones","uid","gestionadoPor","gestionadoEl"]);
const plano=(d,extra)=>{const o={};Object.entries(d).forEach(([k,v])=>{if(extra||!SIN.has(k))o[k]=v});return o};
const pares=d=>(d.levantamiento||[]).map(x=>[x.p,x.r]);
const filas=async(vista,q)=>{
  if(!CFG[vista]||!q.vistas.includes(vista))throw new Error("Sin acceso a esta vista");
  const c=FB.collection(FB.db,"solicitudes");
  return (await FB.getDocs(vista==="bp"?FB.query(c,FB.where("bpCorreo","==",q.email)):FB.query(c,FB.where("estado","in",VISIBLE_GER)))).docs.map(d=>d.data());
};
const API={
  async panelEntrar(email,clave){
    try{await FB.signInWithEmailAndPassword(FB.auth,FB.normalizar(email),String(clave))}catch(e){throw new Error("Correo o clave incorrectos.")}
    return sesion();
  },
  panelQuien:sesion,
  async panelDatos(vista){const q=await sesion();return {email:q.email,vistas:q.vistas,vista,filas:(await filas(vista,q)).map(d=>plano(d)),estados:CFG[vista].estados,editables:CFG[vista].editables}},
  async panelExportar(vista){return (await filas(vista,await sesion())).map(d=>({...plano(d),levantamiento:pares(d),aprobaciones:d.aprobaciones||[]}))},
  async panelDetalle(id,vista){
    await sesion();const s=await FB.getDoc(FB.doc(FB.db,"solicitudes",id));if(!s.exists())throw new Error("Solicitud no disponible");const d=s.data();
    return {puntaje:d.puntaje,clasificacion:d.clasificacion,fortalezas:d.fortalezas,alertas:d.alertas,recomendacion:d.recomendacion,sustento:d.solicitudConcreta,impacto:d.impactoDetalle,editUrl:"",levantamiento:pares(d),aprobaciones:d.aprobaciones||[]};
  },
  async panelActualizar(id,vista,estado,comentario){
    const q=await sesion();if(!CFG[vista]||!CFG[vista].estados.includes(estado))throw new Error("Estado no permitido");
    try{await FB.updateDoc(FB.doc(FB.db,"solicitudes",id),{estado,[CFG[vista].campo]:String(comentario||"").slice(0,1000),gestionadoPor:q.email,gestionadoEl:new Date().toISOString()})}
    catch(e){throw new Error(e.code==="permission-denied"?"Esta solicitud ya no está en tu etapa.":e.message)}
    return {ok:true};
  }
};
// Misma interfaz que google.script.run de Apps Script, para no tocar el resto del panel.
const mk=(ok,ko)=>new Proxy({},{get:(_,k)=>k==="withSuccessHandler"?f=>mk(f,ko):k==="withFailureHandler"?f=>mk(ok,f):(...a)=>API[k](...a).then(d=>ok&&ok(d),e=>ko&&ko(e))});
const google={script:{run:mk()}};
const TITULOS={jefe:"Mis solicitudes",bp:"Bandeja del Business Partner",gerencia:"Gerencia · vista final"};
const ALL=["Nuevo","En revisión BP","Devuelto al jefe","Enviado a Gerencia","Aprobado","Rechazado","En pausa"];
let D=null,vista=null,filtro={q:"",estado:"",periodo:""};
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let TOKEN=null;
const fail=e=>{const m=(e&&e.message||e)+"";if(/venci/.test(m)){TOKEN=null;return mostrarLogin(e)}$("err").hidden=false;$("err").textContent=m;$("app").innerHTML=""};
$("salir").onclick=async()=>{await FB.signOut(FB.auth);TOKEN=null;mostrarLogin()};
function mostrarLogin(e){
  $("err").hidden=true;$("tabs").innerHTML="";$("quien").textContent="";$("salir").style.display="none";
  const m=(e&&e.message||"")+"";
  $("app").innerHTML='<form id="lg" novalidate class="card" style="max-width:380px;margin:30px auto"><h3 style="margin-top:0;color:var(--navy)">Panel de revisión</h3><p class="muted">Ingresa con tu correo institucional y la clave de tu rol (HRBP o Gerencia).</p><p id="lgm" style="color:#B00020">'+(/Inicia sesi|venci|Estás con/.test(m)?"":esc(m))+'</p><p><input id="lgc" type="text" inputmode="email" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="usuario@usil.edu.pe" style="width:100%"></p><p><input id="lgk" type="password" autocomplete="current-password" placeholder="Clave" style="width:100%"></p><button class="p" style="width:100%">Entrar</button></form>';
  $("lg").onsubmit=ev=>{ev.preventDefault();$("lgm").textContent="";
    google.script.run.withFailureHandler(x=>{$("lgm").textContent=x.message||x}).withSuccessHandler(r=>{TOKEN=r.token;cargar(r.vistas[r.vistas.length-1])}).panelEntrar($("lgc").value,$("lgk").value)};
}

function cargar(v){
  vista=v;$("app").innerHTML='<p class="muted">Cargando…</p>';$("err").hidden=true;
  google.script.run.withFailureHandler(fail).withSuccessHandler(d=>{D=d;pintar()}).panelDatos(v,TOKEN);
}
function contar(filas,k){const m={};filas.forEach(f=>{const x=f[k]||"—";m[x]=(m[x]||0)+1});return Object.entries(m).sort((a,b)=>b[1]-a[1])}
function barras(t,pares){const max=Math.max(1,...pares.map(p=>p[1]));
  return `<div class="card"><b>${t}</b>${pares.slice(0,8).map(([k,n])=>`<div class="bar"><span title="${esc(k)}">${esc(k)}</span><i style="width:${n/max*100}px"></i><span>${n}</span></div>`).join("")}</div>`}
function visibles(){const q=filtro.q.toLowerCase();
  return D.filas.filter(f=>(!filtro.estado||f.estado===filtro.estado)&&(!filtro.periodo||f.periodo===filtro.periodo)&&(!q||Object.values(f).join(" ").toLowerCase().includes(q)))
    .sort((a,b)=>String(b.enviadoEl).localeCompare(String(a.enviadoEl)))}
function pintar(){
  $("quien").textContent=D.email;$("salir").style.display="";
  $("tabs").innerHTML=D.vistas.map(v=>`<button class="${v===vista?"on":""}" data-v="${v}">${TITULOS[v]}</button>`).join("");
  const F=D.filas,pend=F.filter(f=>(vista==="gerencia"?["Enviado a Gerencia"]:["Nuevo","En revisión BP"]).includes(f.estado||"Nuevo")).length;
  let h=`<div class="kpis"><div class="card kpi"><b>${F.length}</b><span>Solicitudes</span></div><div class="card kpi"><b>${pend}</b><span>Por revisar</span></div>
   <div class="card kpi"><b>${F.filter(f=>f.estado==="Aprobado").length}</b><span>Aprobadas</span></div><div class="card kpi"><b>${F.filter(f=>f.estado==="Rechazado").length}</b><span>Rechazadas</span></div></div>`;
  if(vista==="gerencia")h+=`<div class="row">${barras("Por estado",contar(F,"estado"))}${barras("Por Business Partner",contar(F,"bp"))}${barras("Por movimiento",contar(F,"movimiento"))}${barras("Por departamento",contar(F,"departamento"))}${barras("Por urgencia",contar(F,"urgencia"))}</div>`;
  const per=[...new Set(F.map(f=>f.periodo))].sort().reverse();
  h+=`<div class="tools"><input id="fq" placeholder="Buscar…" value="${esc(filtro.q)}"><select id="fe"><option value="">Todos los estados</option>${ALL.map(e=>`<option ${e===filtro.estado?"selected":""}>${esc(e)}</option>`).join("")}</select>
   ${vista!=="jefe"?'<button class="p" id="xls" style="margin-left:auto">⬇ Descargar Excel</button>':""}<select id="fp"><option value="">Todos los periodos</option>${per.map(p=>`<option ${p===filtro.periodo?"selected":""}>${esc(p)}</option>`).join("")}</select></div>`;
  const V=visibles();
  h+=`<div class="wrap"><table><tr><th>Fecha</th><th>Movimiento</th><th>Colaborador</th><th>Departamento</th>${vista!=="jefe"?"<th>Líder</th>":""}<th>BP</th><th>Urgencia</th><th>Puntaje</th><th>Estado</th></tr>
  ${V.map(f=>`<tr class="f" data-id="${esc(f.id)}"><td>${esc(f.fechaSolicitud)}</td><td>${esc(f.movimiento)}</td><td>${esc(f.colaborador)}</td><td>${esc(f.departamento)}</td>${vista!=="jefe"?`<td>${esc(f.cliente)}</td>`:""}<td>${esc(f.bp)}</td><td>${esc(f.urgencia)}</td><td>${esc(f.puntaje||"—")}</td><td><span class="tag ${esc(f.estado)}">${esc(f.estado||"Nuevo")}</span></td></tr>`).join("")||'<tr><td colspan="9" class="muted">Sin solicitudes.</td></tr>'}</table></div>`;
  $("app").innerHTML=h;
}
$("tabs").onclick=e=>e.target.dataset.v&&cargar(e.target.dataset.v);
$("app").onclick=e=>{if(e.target.id==="xls")return descargar();const tr=e.target.closest("tr.f");if(tr)detalle(tr.dataset.id)};
$("app").oninput=e=>{if(e.target.id==="fq"){filtro.q=e.target.value;const p=e.target.selectionStart;pintar();$("fq").focus();$("fq").setSelectionRange(p,p)}};
$("app").onchange=e=>{if(e.target.id==="fe"){filtro.estado=e.target.value;pintar()}if(e.target.id==="fp"){filtro.periodo=e.target.value;pintar()}};

// <excel>
// Arma el libro de Excel (4 hojas) con los registros que ve la persona. rows: salida de panelExportar; meta: {titulo, usuario, fecha}.
function construirExcel(ExcelJS, rows, meta) {
  const NAVY = "FF00195A", GRIS = "FFF3F6FC", BORDE = { style: "thin", color: { argb: "FFD9E1F5" } };
  const borde = { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE };
  const wb = new ExcelJS.Workbook();
  wb.creator = "Solicitudes de Talento · USIL"; wb.created = new Date();
  const txt = v => (v == null ? "" : String(v));
  const lista = v => txt(v).split(" | ").join("\n");
  const ESTADO = { "Aprobado": "FFD7F3E0", "Rechazado": "FFFBD9D9", "Enviado a Gerencia": "FFD9E6FF", "Devuelto al jefe": "FFFFE8B3", "En revisión BP": "FFFFF4C2", "Nuevo": "FFEDEFF5", "En pausa": "FFE5E5E5" };
  const relleno = argb => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
  const cabecera = fila => {
    fila.height = 32;
    fila.eachCell(c => { c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 }; c.fill = relleno(NAVY); c.alignment = { vertical: "middle", horizontal: "center", wrapText: true }; c.border = borde; });
  };

  // ---- Resumen
  const rs = wb.addWorksheet("Resumen", { views: [{ showGridLines: false }], properties: { tabColor: { argb: NAVY } } });
  rs.columns = [{ width: 38 }, { width: 14 }, { width: 4 }, { width: 38 }, { width: 14 }];
  rs.mergeCells("A1:E1");
  rs.getCell("A1").value = meta.titulo; rs.getCell("A1").font = { bold: true, size: 16, color: { argb: NAVY } }; rs.getRow(1).height = 28;
  rs.getCell("A2").value = "Generado el " + meta.fecha + " por " + meta.usuario; rs.getCell("A2").font = { italic: true, color: { argb: "FF5B6A8F" } };
  const puntajes = rows.map(r => Number(r.puntaje)).filter(n => n > 0);
  const prom = puntajes.length ? Math.round(puntajes.reduce((a, b) => a + b, 0) / puntajes.length) : "—";
  [["Solicitudes en este archivo", rows.length], ["Puntaje promedio de preparación (solo app web)", prom]].forEach((p, i) => {
    const f = rs.getRow(4 + i); f.getCell(1).value = p[0]; f.getCell(2).value = p[1];
    f.getCell(1).font = { bold: true }; f.getCell(2).font = { bold: true, size: 14, color: { argb: NAVY } }; f.getCell(2).alignment = { horizontal: "center" };
  });
  const contar = k => { const m = {}; rows.forEach(r => { const x = txt(r[k]) || "(sin dato)"; m[x] = (m[x] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const tabla = (col, fila0, titulo, datos) => {
    const h = rs.getRow(fila0); h.getCell(col).value = titulo; h.getCell(col + 1).value = "Solicitudes";
    [col, col + 1].forEach(c => { const x = h.getCell(c); x.font = { bold: true, color: { argb: "FFFFFFFF" } }; x.fill = relleno(NAVY); x.alignment = { horizontal: c === col ? "left" : "center" }; });
    datos.forEach((d, i) => {
      const f = rs.getRow(fila0 + 1 + i); f.getCell(col).value = d[0]; f.getCell(col + 1).value = d[1]; f.getCell(col + 1).alignment = { horizontal: "center" };
      [col, col + 1].forEach(c => { f.getCell(c).border = borde; if (i % 2) f.getCell(c).fill = relleno(GRIS); });
    });
    return fila0 + datos.length + 2;
  };
  const e = contar("estado"), b = contar("bp"), mv = contar("movimiento"), dp = contar("departamento");
  const f1 = tabla(1, 7, "Por estado", e); tabla(4, 7, "Por Business Partner", b);
  const f2 = Math.max(f1, 7 + b.length + 2); tabla(1, f2, "Por tipo de movimiento", mv); tabla(4, f2, "Por departamento", dp);

  // ---- Solicitudes (una fila por solicitud)
  const COLS = [
    ["ID", "id", 22], ["Fecha de solicitud", "fechaSolicitud", 14], ["Estado", "estado", 20], ["Puntaje (0-100)", "puntaje", 11], ["Tipo de movimiento", "movimiento", 24],
    ["Colaborador", "colaborador", 30], ["Matrícula", "codigo", 13], ["Puesto actual", "puestoActual", 30], ["Departamento", "departamento", 34], ["Área", "area", 28], ["Sección", "seccion", 28],
    ["Líder solicitante", "cliente", 26], ["Cargo del líder", "cargoCliente", 28], ["Correo del líder", "enviadoPor", 28], ["BP asignado", "bp", 20],
    ["Urgencia", "urgencia", 18], ["Impacto", "impacto", 11], ["Consecuencia de no aprobar", "consecuencia", 28], ["Detalle del impacto", "impactoDetalle", 50],
    ["¿Presupuesto?", "presupuesto", 14], ["Fuente de presupuesto", "fuentePresupuesto", 24], ["Quién valida", "validaPresupuesto", 24], ["Monto (S/)", "montoPresupuesto", 13], ["¿Aprobación previa?", "tieneAprobacion", 13],
    ["Comentario del BP", "comentarioBP", 40], ["Comentario de Gerencia", "comentarioGerencia", 40],
    ["Clasificación", "clasificacion", 26], ["Alertas", "alertas", 44], ["Fortalezas", "fortalezas", 44], ["Recomendación", "recomendacion", 50], ["Sustento ejecutivo", "solicitudConcreta", 70],
    ["Origen", "origen", 12], ["Enviado el", "enviadoEl", 20]
  ];
  const ws = wb.addWorksheet("Solicitudes", { views: [{ state: "frozen", xSplit: 3, ySplit: 1 }], properties: { tabColor: { argb: "FF0036DC" } } });
  ws.columns = COLS.map(c => ({ header: c[0], key: c[1], width: c[2] }));
  cabecera(ws.getRow(1));
  const ordenadas = rows.slice().sort((x, y) => txt(y.fechaSolicitud).localeCompare(txt(x.fechaSolicitud)));
  const valor = (r, k) => {
    const v = r[k];
    if (k === "alertas" || k === "fortalezas") return lista(v);
    if ((k === "montoPresupuesto" || k === "puntaje") && txt(v) !== "" && !isNaN(v)) return Number(v);
    if (k === "enviadoEl") return txt(v).replace("T", " ").slice(0, 16);
    return txt(v);
  };
  ordenadas.forEach((r, i) => {
    const o = {}; COLS.forEach(c => { o[c[1]] = valor(r, c[1]); });
    const f = ws.addRow(o);
    f.eachCell(c => { c.alignment = { vertical: "top", wrapText: true }; c.border = borde; if (i % 2) c.fill = relleno(GRIS); });
    const est = f.getCell("estado"); est.fill = relleno(ESTADO[o.estado || "Nuevo"] || ESTADO.Nuevo); est.font = { bold: true }; est.alignment = { vertical: "top", horizontal: "center", wrapText: true };
    const pu = f.getCell("puntaje"); pu.alignment = { vertical: "top", horizontal: "center" };
    if (typeof o.puntaje === "number") { pu.fill = relleno(o.puntaje >= 85 ? "FFD7F3E0" : o.puntaje >= 60 ? "FFFFF4C2" : "FFFBD9D9"); pu.font = { bold: true }; }
    f.getCell("montoPresupuesto").numFmt = "#,##0.00";
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLS.length } };

  // ---- Levantamiento (una fila por pregunta y respuesta)
  const wl = wb.addWorksheet("Levantamiento", { views: [{ state: "frozen", ySplit: 1 }], properties: { tabColor: { argb: "FFF3BE00" } } });
  wl.columns = [{ header: "ID", key: "id", width: 22 }, { header: "Colaborador", key: "col", width: 30 }, { header: "Tipo de movimiento", key: "mov", width: 24 }, { header: "Pregunta", key: "p", width: 60 }, { header: "Respuesta", key: "r", width: 90 }];
  cabecera(wl.getRow(1));
  let alterna = false, ultimo = "";
  ordenadas.forEach(r => {
    (r.levantamiento || []).forEach(par => {
      if (r.id !== ultimo) { alterna = !alterna; ultimo = r.id; }
      const f = wl.addRow({ id: r.id, col: txt(r.colaborador), mov: txt(r.movimiento), p: txt(par[0]), r: txt(par[1]) });
      f.eachCell(c => { c.alignment = { vertical: "top", wrapText: true }; c.border = borde; if (alterna) c.fill = relleno(GRIS); });
      f.getCell("p").font = { bold: true, color: { argb: NAVY } };
    });
  });
  wl.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 5 } };

  // ---- Aprobaciones previas
  const wa = wb.addWorksheet("Aprobaciones", { views: [{ state: "frozen", ySplit: 1 }], properties: { tabColor: { argb: "FF7A8CC0" } } });
  wa.columns = [{ header: "ID", key: "id", width: 22 }, { header: "Colaborador", key: "col", width: 30 }, { header: "Nivel", key: "n", width: 22 }, { header: "Aprobador", key: "a", width: 30 }, { header: "Cargo", key: "c", width: 30 }, { header: "Fecha", key: "f", width: 14 }, { header: "¿Evidencia?", key: "e", width: 13 }, { header: "Tipo de evidencia", key: "t", width: 20 }];
  cabecera(wa.getRow(1));
  ordenadas.forEach(r => (r.aprobaciones || []).forEach(a => {
    const f = wa.addRow({ id: r.id, col: txt(r.colaborador), n: txt(a.level), a: txt(a.name), c: txt(a.role), f: txt(a.date), e: txt(a.evidence), t: txt(a.type) });
    f.eachCell(c => { c.alignment = { vertical: "top", wrapText: true }; c.border = borde; });
  }));
  wa.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 8 } };
  return wb;
}
// </excel>

function descargar(){
  const btn=(t,off)=>{const b=$("xls");if(b){b.textContent=t;b.disabled=off}};
  btn("Preparando…",true);
  google.script.run.withFailureHandler(e=>{btn("⬇ Descargar Excel",false);alert(e.message||e)}).withSuccessHandler(async rows=>{
    try{
      if(typeof ExcelJS==="undefined") throw new Error("No se pudo cargar la librería de Excel. Revisa tu conexión y recarga.");
      const wb=construirExcel(ExcelJS,rows,{titulo:"Solicitudes de Talento · "+TITULOS[vista],usuario:D.email,fecha:new Date().toLocaleString("es-PE")});
      const buf=await wb.xlsx.writeBuffer();
      const a=document.createElement("a");
      a.href=URL.createObjectURL(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
      a.download="Solicitudes_Talento_"+vista+"_"+new Date().toISOString().slice(0,10)+".xlsx";
      document.body.appendChild(a);a.click();a.remove();
    }catch(x){alert("No se pudo generar el Excel: "+(x.message||x))}
    btn("⬇ Descargar Excel",false);
  }).panelExportar(vista,TOKEN);
}

// ---------- Detalle de una solicitud (ventana con encabezado, secciones y barra de acciones fija) ----------
function aviso(t){let e=$("toast");if(!e){e=document.createElement("div");e.id="toast";document.body.appendChild(e)}e.textContent=t;e.className="show";clearTimeout(aviso.t);aviso.t=setTimeout(()=>{e.className=""},3500)}
const lis=s=>String(s||"").split(" | ").filter(Boolean).map(x=>`<li>${esc(x)}</li>`).join("");
const fila=(k,v)=>v==null||String(v).trim()===""?"":`<div class="kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>`;
// Acciones por rol: [texto, estado nuevo (null = conservar el actual), estilo, exige comentario, aviso de éxito, pide confirmación]
const ACCIONES={
  bp:[["Guardar observación",null,"sec",false,"Observación guardada",false],["Devolver al jefe","Devuelto al jefe","warn",true,"Solicitud devuelta al jefe",false],["Pausar","En pausa","sec",false,"Solicitud en pausa",false],["Escalar a Gerencia ➜","Enviado a Gerencia","ok",false,"Solicitud escalada: ya está en la bandeja de Gerencia",true]],
  gerencia:[["Guardar comentario",null,"sec",false,"Comentario guardado",false],["Devolver al BP","En revisión BP","warn",true,"Solicitud devuelta al Business Partner",false],["Rechazar","Rechazado","bad",true,"Solicitud rechazada",true],["Aprobar ✓","Aprobado","ok",false,"Solicitud aprobada",true]]
};
function detalle(id){
  const f=D.filas.find(x=>x.id===id),ed=D.editables.includes(f.estado||"Nuevo");
  google.script.run.withFailureHandler(fail).withSuccessHandler(d=>{
    const p=Number(d.puntaje),nivel=p>=85?"alto":p>=60?"medio":"bajo",previos=[["Business Partner",f.comentarioBP],["Gerencia",f.comentarioGerencia]].filter(x=>x[1]);
    $("dlg").innerHTML=`
     <div class="dh"><div><span class="mov">${esc(f.movimiento)}</span><h2>${esc(f.colaborador)}</h2>
       <div class="meta"><span class="tag ${esc(f.estado)}">${esc(f.estado||"Nuevo")}</span><span>${esc(f.fechaSolicitud)}</span><span class="id">${esc(f.id)}</span></div></div>
       <button type="button" class="x" id="cerrarX" aria-label="Cerrar">✕</button></div>
     <div class="db">
      <section class="sec"><h4>Resumen</h4><div class="grid">
        ${fila("Líder solicitante",f.cliente+" · "+f.cargoCliente)}${fila("Departamento",f.departamento)}${fila("Área",f.area)}${fila("Sección",f.seccion)}
        ${fila("Matrícula",f.codigo)}${fila("Puesto actual",f.puestoActual)}${fila("Business Partner",f.bp)}${fila("Urgencia",f.urgencia)}
        ${fila("Impacto si no se ejecuta",f.impacto)}${fila("Consecuencia",f.consecuencia)}</div></section>
      <section class="sec"><h4>Presupuesto</h4><div class="grid">${fila("¿Cuenta con presupuesto?",f.presupuesto)}${fila("Fuente",f.fuentePresupuesto)}${fila("Quién valida",f.validaPresupuesto)}${fila("Monto",f.montoPresupuesto!==""?"S/ "+f.montoPresupuesto:"")}</div></section>
      ${d.puntaje?`<section class="sec"><h4>Evaluación automática</h4>
        <div class="score"><div class="ring ${nivel}">${esc(d.puntaje)}</div><div><b>${esc(d.clasificacion)}</b><p class="muted">${esc(d.recomendacion)}</p></div></div>
        <div class="two">${d.fortalezas?`<div class="good"><h5>Fortalezas</h5><ul>${lis(d.fortalezas)}</ul></div>`:""}${d.alertas?`<div class="warnb"><h5>Alertas</h5><ul>${lis(d.alertas)}</ul></div>`:""}</div></section>`:""}
      <section class="sec"><h4>Detalle del impacto</h4><p class="txt">${esc(d.impacto)}</p></section>
      ${d.sustento?`<section class="sec"><h4>Sustento ejecutivo</h4><p class="txt">${esc(d.sustento)}</p></section>`:""}
      ${d.levantamiento.length?`<section class="sec"><h4>Levantamiento</h4>${d.levantamiento.map(([k,v])=>`<div class="qa"><span>${esc(k)}</span><p>${esc(v)}</p></div>`).join("")}</section>`:""}
      ${d.aprobaciones.length?`<section class="sec"><h4>Aprobaciones previas</h4><div class="two">${d.aprobaciones.map(a=>`<div class="ap"><b>${esc(a.name)}</b><span>${esc(a.role)} · ${esc(a.level)}</span><span>${esc(a.date)} · Evidencia: ${esc(a.evidence)}${a.type?" ("+esc(a.type)+")":""}</span></div>`).join("")}</div></section>`:""}
      ${previos.length?`<section class="sec"><h4>Comentarios anteriores</h4>${previos.map(([q,t])=>`<div class="qa"><span>${esc(q)}</span><p>${esc(t)}</p></div>`).join("")}</section>`:""}
     </div>
     <div class="df">${ed?`<label for="nc">Observación o comentario${vista==="bp"?" (lo ve Gerencia y, si la devuelves, el jefe)":""}</label>
       <textarea id="nc" rows="2" placeholder="Escribe aquí tu observación…">${esc(vista==="bp"?f.comentarioBP:f.comentarioGerencia)}</textarea>
       <div class="acts"><button type="button" class="btn sec" id="cerrar">Cerrar</button><span class="sp"></span>${ACCIONES[vista].map((a,i)=>`<button type="button" class="btn ${a[2]}" data-i="${i}">${esc(a[0])}</button>`).join("")}</div>`
       :`<div class="acts"><span class="muted">Esta solicitud ya no está en tu etapa: solo lectura.</span><span class="sp"></span><button type="button" class="btn sec" id="cerrar">Cerrar</button></div>`}</div>`;
    const dlg=$("dlg");dlg.showModal();dlg.scrollTop=0;
    const cerrar=()=>dlg.close();$("cerrarX").onclick=cerrar;$("cerrar").onclick=cerrar;
    dlg.onclick=e=>{if(e.target===dlg)cerrar()};   // clic fuera de la ventana
    if(ed)dlg.querySelectorAll("[data-i]").forEach(b=>b.onclick=()=>{
      const [txt,nuevo,,exige,ok,confirma]=ACCIONES[vista][b.dataset.i],coment=$("nc").value.trim();
      const estado=nuevo||(D.estados.includes(f.estado)?f.estado:D.estados[0]);
      if(exige&&!coment){$("nc").focus();$("nc").classList.add("falta");return aviso("Escribe una observación para continuar")}
      if(confirma&&!confirm(`¿${txt.replace(/[➜✓]/g,"").trim()}? Esta acción se registra a tu nombre.`))return;
      dlg.querySelectorAll("button").forEach(x=>x.disabled=true);
      google.script.run.withFailureHandler(e=>{dlg.querySelectorAll("button").forEach(x=>x.disabled=false);aviso(e.message||e)}).withSuccessHandler(()=>{dlg.close();cargar(vista);aviso("✓ "+ok)}).panelActualizar(id,vista,estado,coment,TOKEN)});
  }).panelDetalle(id,vista,TOKEN);
}
google.script.run.withFailureHandler(mostrarLogin).withSuccessHandler(q=>cargar(q.vistas[q.vistas.length-1])).panelQuien();

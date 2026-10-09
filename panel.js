import * as FB from "./firebase.js";
import { redactar } from "./redactor.mjs";
import { metricas, aplicarFiltros, prioridad, movimientoPorEstado, tendencia, lecturas, metricasBP } from "./tablero.mjs";   // indicadores del tablero de Gerencia   // motor de redacción ejecutiva (determinista)
// Panel de HRBP y Gerencia sobre Firestore. Las reglas (firestore.rules) deciden qué ve y qué cambia cada rol; aquí solo se consulta.
const VISIBLE_GER=["Enviado a Gerencia","Aprobado","Rechazado"];
const CFG={bp:{estados:["En revisión BP","Devuelto al jefe","Enviado a Gerencia","En pausa"],editables:["Nuevo","En revisión BP","Devuelto al jefe","En pausa"],campo:"comentarioBP"},
  gerencia:{estados:["Enviado a Gerencia","Aprobado","Rechazado","En revisión BP"],editables:VISIBLE_GER,campo:"comentarioGerencia"}};
const sesion=async()=>{
  const u=await FB.usuario();if(!u||!u.providerData.some(x=>x.providerId==="password"))throw new Error("Inicia sesión");
  if(!u.emailVerified){await FB.signOut(FB.auth);throw new Error("Falta confirmar tu correo: abre el enlace que te enviamos y vuelve a entrar.")}

  const s=await FB.getDoc(FB.doc(FB.db,"roles",u.email));const vistas=s.exists()?(s.data().roles||[]).filter(r=>CFG[r]):[];
  if(!vistas.length){await FB.signOut(FB.auth);throw new Error("Tu cuenta no tiene un rol asignado.")}
  return {token:"fb",email:u.email,vistas,bpId:s.data().bpId};
};
const SIN=new Set(["levantamiento","aprobaciones","uid","gestionadoPor","gestionadoEl"]);
const plano=(d,extra)=>{const o={};Object.entries(d).forEach(([k,v])=>{if(extra||!SIN.has(k))o[k]=v});return o};
const pares=d=>(d.levantamiento||[]).map(x=>[x.p,x.r]);
const nombres=async()=>{if(!nombres.c){nombres.c={};(await FB.getDocs(FB.collection(FB.db,"bps"))).forEach(d=>{nombres.c[d.id]=d.data().nombre})}return nombres.c};
const filas=async(vista,q)=>{
  if(!CFG[vista]||!q.vistas.includes(vista))throw new Error("Sin acceso a esta vista");
  const c=FB.collection(FB.db,"solicitudes");
  if(vista==="bp"&&!q.bpId)throw new Error("Tu cuenta no tiene un Business Partner asignado.");
  const [docs,n]=await Promise.all([FB.getDocs(vista==="bp"?FB.query(c,FB.where("bpId","==",q.bpId)):FB.query(c,FB.where("estado","in",VISIBLE_GER))),nombres()]);
  return docs.docs.map(d=>({...d.data(),bp:n[d.data().bpId]||"—",derivadoPor:d.data().derivadoDe?(n[d.data().derivadoDe]||"otro BP"):""}));
};
const API={
  // Cada Business Partner / Gerencia crea su propia cuenta con su correo y la clave que elija; el correo se confirma con un enlace.
  // Solo entran los correos que el administrador autorizó (documento roles/{correo}); una cuenta sin autorización no ve nada.
  async panelCrear(email,clave,clave2){
    email=FB.normalizar(email);
    if(!/^[^@\s]+@usil\.edu\.pe$/.test(email))throw new Error("Usa tu correo institucional (@usil.edu.pe).");
    if(String(clave).length<12)throw new Error("Tu clave debe tener 12 o más caracteres.");
    if(clave!==clave2)throw new Error("Las dos claves no coinciden.");
    let u;
    try{await FB.setPersistence(FB.auth,FB.browserSessionPersistence);u=(await FB.createUserWithEmailAndPassword(FB.auth,email,clave)).user}
    catch(e){throw new Error(e.code==="auth/email-already-in-use"?"Ese correo ya tiene cuenta: entra con tu clave o usa «Olvidé mi clave».":e.code==="auth/weak-password"?"Esa clave es demasiado débil.":"No se pudo crear la cuenta. Intenta de nuevo.")}
    try{await FB.sendEmailVerification(u)}finally{await FB.signOut(FB.auth)}
    return {mensaje:"Cuenta creada. Te enviamos un enlace a "+email+": ábrelo para confirmar tu correo y luego entra con tu clave."};
  },
  async panelOlvide(email){
    try{await FB.sendPasswordResetEmail(FB.auth,FB.normalizar(email))}catch(e){if(e.code!=="auth/user-not-found"&&e.code!=="auth/invalid-email")throw new Error("No se pudo enviar el correo ahora. Intenta más tarde.")}
    return {mensaje:"Si tu correo tiene cuenta, te llegará un enlace para elegir una clave nueva."};   // misma respuesta exista o no: no revela quién tiene cuenta
  },
  async panelEntrar(email,clave){
    try{await FB.setPersistence(FB.auth,FB.browserSessionPersistence);await FB.signInWithEmailAndPassword(FB.auth,FB.normalizar(email),String(clave))}catch(e){throw new Error("Correo o clave incorrectos.")}
    return sesion();
  },
  panelQuien:sesion,
  async panelDatos(vista){const q=await sesion();return {email:q.email,bpId:q.bpId,vistas:q.vistas,vista,filas:(await filas(vista,q)).map(d=>plano(d)),estados:CFG[vista].estados,editables:CFG[vista].editables}},
  async panelExportar(vista){return (await filas(vista,await sesion())).map(d=>({...plano(d),levantamiento:pares(d),aprobaciones:d.aprobaciones||[]}))},
  async panelDetalle(id,vista){
    await sesion();const s=await FB.getDoc(FB.doc(FB.db,"solicitudes",id));if(!s.exists())throw new Error("Solicitud no disponible");const d=s.data();
    return {puntaje:d.puntaje,clasificacion:d.clasificacion,fortalezas:d.fortalezas,alertas:d.alertas,recomendacion:d.recomendacion,registro:plano(d,true),sustento:d.solicitudConcreta,impacto:d.impactoDetalle,editUrl:"",levantamiento:pares(d),aprobaciones:d.aprobaciones||[]};
  },
  async panelActualizar(id,vista,estado,comentario,extra){
    const q=await sesion();if(!CFG[vista]||!CFG[vista].estados.includes(estado))throw new Error("Estado no permitido");
    const cambios={estado,[CFG[vista].campo]:String(comentario||"").slice(0,1000),gestionadoPor:q.email,gestionadoEl:new Date().toISOString()};
    if(vista==="bp"&&extra&&typeof extra==="object"){
      if(extra.textoGerencia!=null){cambios.textoGerencia=String(extra.textoGerencia).slice(0,20000);cambios.textoOrigen=String(extra.textoOrigen||"").slice(0,30)}
      if(extra.derivarA){if(extra.derivarA===q.bpId)throw new Error("Elige a otro Business Partner.");cambios.bpId=String(extra.derivarA);cambios.derivadoDe=q.bpId;cambios.estado="En revisión BP"}   // pasa a la bandeja de otro BP
    }
    try{await FB.updateDoc(FB.doc(FB.db,"solicitudes",id),cambios)}
    catch(e){throw new Error(e.code==="permission-denied"?"Esta solicitud ya no está en tu etapa.":e.message)}
    return {ok:true};
  }
};
// Misma interfaz que google.script.run de Apps Script, para no tocar el resto del panel.
const mk=(ok,ko)=>new Proxy({},{get:(_,k)=>k==="withSuccessHandler"?f=>mk(f,ko):k==="withFailureHandler"?f=>mk(ok,f):(...a)=>API[k](...a).then(d=>ok&&ok(d),e=>ko&&ko(e))});
const google={script:{run:mk()}};
const TITULOS={jefe:"Mis solicitudes",bp:"Bandeja del Business Partner",gerencia:"Gerencia · vista final"};
const ALL=["Nuevo","En revisión BP","Devuelto al jefe","Enviado a Gerencia","Aprobado","Rechazado","En pausa"];
let D=null,vista=null,filtro={q:"",estado:"",periodo:"",movimiento:"",departamento:"",bp:"",atencion:""};
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let TOKEN=null;
const fail=e=>{const m=(e&&e.message||e)+"";if(/venci/.test(m)){TOKEN=null;return mostrarLogin(e)}$("err").hidden=false;$("err").textContent=m;$("app").innerHTML=""};
$("salir").onclick=async()=>{await FB.signOut(FB.auth);TOKEN=null;mostrarLogin()};
const TEXTOS={
  entrar:["Panel de revisión","Ingresa con tu correo institucional y tu clave (Business Partner o Gerencia).","Entrar"],
  crear:["Crear mi cuenta","Primera vez: usa tu correo institucional autorizado y elige tu clave (12 o más caracteres). Te enviaremos un enlace para confirmar tu correo.","Crear cuenta"],
  olvide:["Recuperar mi clave","Te enviaremos un enlace al correo para elegir una clave nueva.","Enviar enlace"]};
function mostrarLogin(e,modo){
  modo=TEXTOS[modo]?modo:"entrar";
  $("err").hidden=true;$("tabs").innerHTML="";$("quien").textContent="";$("salir").style.display="none";
  const m=(e&&e.message||"")+"",[titulo,ayuda,boton]=TEXTOS[modo];
  const campo=(id,tipo,ph,ac)=>'<p><input id="'+id+'" type="'+tipo+'" autocomplete="'+ac+'" autocapitalize="none" spellcheck="false" placeholder="'+ph+'" style="width:100%"></p>';
  $("app").innerHTML='<form id="lg" novalidate class="card" style="max-width:400px;margin:30px auto"><h3 style="margin-top:0;color:var(--navy)">'+titulo+'</h3><p class="muted">'+ayuda+'</p><p id="lgm" style="color:#B00020">'+(/Inicia sesi|venci|Estás con/.test(m)?"":esc(m))+'</p>'+
    campo("lgc","text","usuario@usil.edu.pe","username")+(modo==="olvide"?"":campo("lgk","password",modo==="crear"?"Elige tu clave (12 o más caracteres)":"Clave",modo==="crear"?"new-password":"current-password"))+(modo==="crear"?campo("lgk2","password","Repite tu clave","new-password"):"")+
    '<button class="p" style="width:100%">'+boton+'</button><p class="lnks">'+(modo==="entrar"?'<button type="button" class="lnk" data-m="crear">Crear mi cuenta</button><button type="button" class="lnk" data-m="olvide">Olvidé mi clave</button>':'<button type="button" class="lnk" data-m="entrar">← Volver a entrar</button>')+'</p></form>';
  $("lg").querySelectorAll(".lnk").forEach(x=>x.onclick=()=>mostrarLogin(null,x.dataset.m));
  const dec=(txt,bien)=>{$("lgm").textContent=txt;$("lgm").style.color=bien?"#17844A":"#B00020"};
  $("lg").onsubmit=ev=>{ev.preventDefault();dec("");const b=$("lg").querySelector("button.p");b.disabled=true;const fin=()=>{b.disabled=false};
    const fallo=x=>{dec(x.message||x);fin()};
    if(modo==="entrar")google.script.run.withFailureHandler(fallo).withSuccessHandler(r=>{TOKEN=r.token;cargar(r.vistas[r.vistas.length-1])}).panelEntrar($("lgc").value,$("lgk").value);
    else if(modo==="crear")google.script.run.withFailureHandler(fallo).withSuccessHandler(r=>{dec(r.mensaje,true);$("lgk").value=$("lgk2").value="";fin()}).panelCrear($("lgc").value,$("lgk").value,$("lgk2").value);
    else google.script.run.withFailureHandler(fallo).withSuccessHandler(r=>{dec(r.mensaje,true);fin()}).panelOlvide($("lgc").value)};
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
  if(vista==="gerencia")return pintarGerencia();
  const F=D.filas,pend=F.filter(f=>(vista==="gerencia"?["Enviado a Gerencia"]:["Nuevo","En revisión BP"]).includes(f.estado||"Nuevo")).length;
  let h=vista==="bp"?pintarBP(F):`<div class="kpis"><div class="card kpi"><b>${F.length}</b><span>Solicitudes</span></div><div class="card kpi"><b>${pend}</b><span>Por revisar</span></div>
   <div class="card kpi"><b>${F.filter(f=>f.estado==="Aprobado").length}</b><span>Aprobadas</span></div><div class="card kpi"><b>${F.filter(f=>f.estado==="Rechazado").length}</b><span>Rechazadas</span></div></div>`;
  if(vista==="gerencia")h+=`<div class="row">${barras("Por estado",contar(F,"estado"))}${barras("Por Business Partner",contar(F,"bp"))}${barras("Por movimiento",contar(F,"movimiento"))}${barras("Por departamento",contar(F,"departamento"))}${barras("Por urgencia",contar(F,"urgencia"))}</div>`;
  if(vista==="bp"){$("app").innerHTML=h+tablaBandeja(F,visibles(),"bp");return}
  const per=[...new Set(F.map(f=>f.periodo))].sort().reverse();
  h+=`<div class="tools"><input id="fq" placeholder="Buscar…" value="${esc(filtro.q)}"><select id="fe"><option value="">Todos los estados</option>${ALL.map(e=>`<option ${e===filtro.estado?"selected":""}>${esc(e)}</option>`).join("")}</select>
   ${vista!=="jefe"?'<button class="p" id="xls" style="margin-left:auto">⬇ Descargar Excel</button>':""}<select id="fp"><option value="">Todos los periodos</option>${per.map(p=>`<option ${p===filtro.periodo?"selected":""}>${esc(p)}</option>`).join("")}</select></div>`;
  const V=visibles();
  h+=`<div class="wrap"><table><tr><th>Fecha</th><th>Movimiento</th><th>Colaborador</th><th>Departamento</th>${vista!=="jefe"?"<th>Líder</th>":""}<th>BP</th><th>Urgencia</th><th>Puntaje</th><th>Estado</th></tr>
  ${V.map(f=>`<tr class="f" data-id="${esc(f.id)}"><td>${esc(f.fechaSolicitud)}</td><td>${esc(f.movimiento)}</td><td>${esc(f.colaborador)}</td><td>${esc(f.departamento)}</td>${vista!=="jefe"?`<td>${esc(f.cliente)}</td>`:""}<td>${esc(f.bp)}</td><td>${esc(f.urgencia)}</td><td>${esc(f.puntaje||"—")}</td><td><span class="tag ${esc(f.estado)}">${esc(f.estado||"Nuevo")}</span>${f.derivadoPor?` <span class="pill u3" title="Derivada por otro Business Partner">↪ ${esc(f.derivadoPor)}</span>`:""}</td></tr>`).join("")||'<tr><td colspan="9" class="muted">Sin solicitudes.</td></tr>'}</table></div>`;
  $("app").innerHTML=h;
}
// ---------- Tablero gerencial (vista de Gerencia): indicadores, flujo, casos que requieren atención, gráficos y bandeja ----------
const MESES=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const periodoTxt=p=>p?MESES[+p.slice(5)-1].replace(/^./,c=>c.toUpperCase())+" "+p.slice(0,4):"Todos los periodos";
const IC={
  doc:'<svg viewBox="0 0 24 24"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/></svg>',
  reloj:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  ok:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/></svg>',
  no:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
  star:'<svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
  cal:'<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  alerta:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/></svg>'};
const ETIQ={urgentes:"Urgentes pendientes",bajos:"Preparación baja (<60)",pendientes:"Pendientes de decisión"};
const PILL_U={"Inmediato":"u1","Dentro de 30 días":"u2","Dentro de 60 días":"u3","Más adelante":"u4"},PILL_E={"Enviado a Gerencia":"e1","Aprobado":"e2","Rechazado":"e3"};
const casos=n=>n===1?"caso":"casos";
const iniciales=n=>String(n||"?").trim().split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase();
const nivelP=p=>p>=85?"alto":p>=60?"medio":"bajo";
const edad=d=>d==null?"":d===0?"hoy":d===1?"hace 1 día":`hace ${d} días`;
const mesCorto=p=>MESES[+p.slice(5)-1].slice(0,3).replace(/^./,c=>c.toUpperCase())+" "+p.slice(2,4);
/** Fila de un caso que pide acción: abre el detalle. */
const filaCaso=f=>`<button type="button" class="px-row" data-ver="${esc(f.id)}"><i class="px-av">${esc(iniciales(f.colaborador))}</i>
  <span class="px-mn"><b>${esc(f.colaborador||"—")}</b><em>${esc(f.movimiento)} · ${esc(f.departamento)}</em></span>
  <span class="pill ${PILL_U[f.urgencia]||"u4"}">${esc(f.urgencia||"—")}</span>${f.dias!=null?`<small class="px-ed">${edad(f.dias)}</small>`:""}
  ${f.puntaje?`<span class="px-sc ${nivelP(+f.puntaje)}" title="Preparación del caso">${esc(f.puntaje)}</span>`:""}</button>`;
const kpiPx=(cl,n,t,s,f)=>`<button type="button" class="px-kpi ${cl}" ${f?`data-f="${f}"`:""}><span>${t}</span><b>${esc(n)}</b><em>${s}</em></button>`;
const barraPx=(clave,pares)=>{const max=Math.max(1,...pares.map(x=>x[1]));return pares.length?pares.map(([k,n])=>`<button type="button" class="px-bar${clave&&filtro[clave]===k?" on":""}" ${clave?`data-f="${clave}:${esc(k)}"`:""}><span class="n" title="${esc(k)}">${esc(k)}</span><span class="t"><i style="width:${Math.round(n/max*100)}%"></i></span><b>${n}</b></button>`).join(""):'<p class="muted">Sin datos.</p>'};
function tablaBandeja(F,V,rol){
  const per=[...new Set(F.map(f=>f.periodo))].sort().reverse();
  return `<section class="gx-card" id="bandeja"><h3>${rol==="gerencia"?"Todas las solicitudes":"Bandeja completa"}</h3>
   <div class="tools"><input id="fq" placeholder="Buscar por colaborador, área o movimiento…" value="${esc(filtro.q)}" style="min-width:240px;flex:1"><select id="fe"><option value="">Todos los estados</option>${(rol==="gerencia"?["Enviado a Gerencia","Aprobado","Rechazado"]:ALL).map(x=>`<option${x===filtro.estado?" selected":""}>${esc(x)}</option>`).join("")}</select>
   ${rol==="gerencia"?"":`<select id="fp"><option value="">Todos los periodos</option>${per.map(p=>`<option ${p===filtro.periodo?"selected":""}>${esc(p)}</option>`).join("")}</select>`}<button class="p" id="xls">⬇ Descargar Excel</button></div>
   ${filtro.estado||filtro.movimiento||filtro.departamento?`<div class="tools">${[filtro.estado,filtro.movimiento,filtro.departamento].filter(Boolean).map(v=>`<span class="gx-chip">${esc(v)}</span>`).join("")}<button type="button" class="gx-chip" data-f="limpiar:1">Limpiar filtros</button></div>`:""}
   <div class="wrap"><table><tr><th>Fecha</th><th>Colaborador</th><th>Movimiento</th><th>Departamento</th><th>Líder</th><th>BP</th><th>Urgencia</th><th>Puntaje</th><th>Estado</th><th></th></tr>
   ${V.map(f=>`<tr class="f" data-id="${esc(f.id)}"><td>${esc(f.fechaSolicitud)}</td><td>${esc(f.colaborador)}</td><td>${esc(f.movimiento)}</td><td>${esc(f.departamento)}</td><td>${esc(f.cliente)}</td><td>${esc(f.bp)}${f.derivadoPor?` <span class="pill u3" title="Derivada por otro Business Partner">↪ ${esc(f.derivadoPor)}</span>`:""}</td><td><span class="pill ${PILL_U[f.urgencia]||"u4"}">${esc(f.urgencia||"—")}</span></td><td>${esc(f.puntaje||"—")}</td><td><span class="pill ${PILL_E[f.estado]||"e0"}">${esc(f.estado||"Nuevo")}</span></td><td><button type="button" class="gx-ver" data-ver="${esc(f.id)}">Ver caso</button></td></tr>`).join("")||'<tr><td colspan="10" class="muted">No hay solicitudes con estos filtros.</td></tr>'}</table></div></section>`;
}
function pintarGerencia(){
  const hoy=new Date(),todos=metricas(D.filas,"",hoy);
  if(!filtro.periodoElegido)filtro.periodo="";   // por defecto se ve todo lo cargado
  const M=metricas(D.filas,filtro.periodo,hoy),A=M.atencion,V=aplicarFiltros(D.filas,filtro);
  const Fp=filtro.periodo?D.filas.filter(f=>f.periodo===filtro.periodo):D.filas;
  const urg=prioridad(Fp,hoy),mv=movimientoPorEstado(Fp),tn=tendencia(D.filas),maxT=Math.max(1,...tn.map(x=>x.total));
  const ls=lecturas(M,M.porMovimiento[0],M.porDepartamento[0]);
  $("app").innerHTML=`
   <div class="px-top"><div><span class="px-eyebrow">Gerencia · Decisión de movimientos</span><h2>Centro de decisiones</h2><p>Lo que necesitas para decidir y sustentar cada movimiento de talento</p></div>
     <label class="gx-per"><i>${IC.cal}</i><span>Periodo<select id="fp">${todos.periodos.map(x=>`<option value="${esc(x)}"${x===filtro.periodo?" selected":""}>${esc(periodoTxt(x))}</option>`).join("")}<option value=""${filtro.periodo===""?" selected":""}>Todos los periodos</option></select></span></label></div>
   <section class="px-lectura"><i>✦</i><div><b>Lectura rápida</b><ul>${ls.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div></section>
   <div class="px-kpis">
     ${kpiPx("primario",M.pendientes,"Por decidir",A.masAntiguo==null?"Nada pendiente":`El más antiguo lleva ${A.masAntiguo} ${A.masAntiguo===1?"día":"días"}`,"atencion:pendientes")}
     ${kpiPx("verde",M.aprobadas,"Aprobadas",M.resueltas?Math.round(M.aprobadas/M.resueltas*100)+"% de lo resuelto":"—","estado:Aprobado")}
     ${kpiPx("rojo",M.rechazadas,"Rechazadas",M.resueltas?Math.round(M.rechazadas/M.resueltas*100)+"% de lo resuelto":"—","estado:Rechazado")}
     ${kpiPx("neutro",M.puntajePromedio==null?"—":M.puntajePromedio,"Preparación promedio",A.bajos?`${A.bajos} pendiente${A.bajos===1?"":"s"} con preparación baja`:"de 100 puntos","atencion:bajos")}
   </div>
   <div class="px-2">
     <section class="gx-card"><h3>Para decidir ahora</h3><p class="sub">Primero lo más urgente y lo que más espera</p>${urg.length?urg.map(filaCaso).join(""):'<p class="muted">No hay casos pendientes. Todo está al día.</p>'}${M.pendientes>urg.length?`<button type="button" class="px-mas" data-f="atencion:pendientes">Ver los ${M.pendientes} pendientes →</button>`:""}</section>
     <section class="gx-card"><h3>Qué se está pidiendo</h3><p class="sub">Movimientos solicitados y cómo van</p>
       ${mv.length?mv.map(x=>`<button type="button" class="px-stk${filtro.movimiento===x.movimiento?" on":""}" data-f="movimiento:${esc(x.movimiento)}"><span class="n">${esc(x.movimiento)}</span><span class="t" style="width:${Math.round(x.total/mv[0].total*100)}%"><i class="pe" style="flex:${esc(x.pendientes)}"></i><i class="ap" style="flex:${esc(x.aprobadas)}"></i><i class="re" style="flex:${esc(x.rechazadas)}"></i></span><b>${esc(x.total)}</b></button>`).join(""):'<p class="muted">Sin datos.</p>'}
       <div class="px-leyenda"><span><i class="pe"></i>Por decidir</span><span><i class="ap"></i>Aprobadas</span><span><i class="re"></i>Rechazadas</span></div></section>
   </div>
   <div class="px-2">
     <section class="gx-card"><h3>Evolución mensual</h3><p class="sub">Solicitudes recibidas por mes</p>
       ${tn.length?`<div class="px-cols">${tn.map(x=>`<div class="px-col"><b>${esc(x.total)}</b><span class="t"><i class="ap" style="height:${Math.round(x.aprobadas/maxT*100)}%"></i><i class="re" style="height:${Math.round(x.rechazadas/maxT*100)}%"></i><i class="pe" style="height:${Math.round((x.total-x.aprobadas-x.rechazadas)/maxT*100)}%"></i></span><em>${esc(mesCorto(x.periodo))}</em></div>`).join("")}</div>`:'<p class="muted">Sin datos.</p>'}</section>
     <section class="gx-card"><h3>Áreas que más piden</h3><p class="sub">Departamentos con más solicitudes</p>${barraPx("departamento",M.porDepartamento.slice(0,5))}</section>
   </div>
   ${tablaBandeja(D.filas,V,"gerencia")}`;
}
function pintarBP(F){
  const B=metricasBP(F,new Date()),tot=Math.max(1,B.total),maxA=Math.max(1,...B.antiguedad.map(y=>y.n));
  const seg=[["#F5B400",B.porRevisar,"Por revisar"],["#E07B39",B.devueltas,"Devueltas al jefe"],["#9AA6C4",B.enPausa,"En pausa"],["#3B6BFF",B.enGerencia,"En Gerencia"],["#1E9E5A",B.aprobadas,"Aprobadas"],["#D64545",B.rechazadas,"Rechazadas"]];
  let acc=0;const cono=seg.map(([c,n])=>{const a=acc/tot*100;acc+=n;return `${c} ${a}% ${acc/tot*100}%`}).join(",");
  const masViejo=B.cola.length?Math.max(...B.cola.map(x=>x.dias||0)):null;
  return `<div class="px-top"><div><span class="px-eyebrow">Business Partner · Gestión</span><h2>Tu bandeja de solicitudes</h2><p>Revisa, devuelve, deriva o escala cada caso</p></div></div>
   <div class="px-kpis">
     ${kpiPx("primario",B.porRevisar,"Por revisar",masViejo==null?"Nada pendiente":`La más antigua lleva ${masViejo} ${masViejo===1?"día":"días"}`,"estado:En revisión BP")}
     ${kpiPx("ambar",B.devueltas,"Devueltas al jefe","Esperan corrección del líder","estado:Devuelto al jefe")}
     ${kpiPx("azul",B.enGerencia,"En Gerencia","Esperan decisión del comité","estado:Enviado a Gerencia")}
     ${kpiPx("verde",B.tasaAprobacion==null?"—":B.tasaAprobacion+"%","Tasa de aprobación","de lo que Gerencia ya resolvió","estado:Aprobado")}
   </div>
   <div class="px-2">
     <section class="gx-card"><h3>Para revisar ahora</h3><p class="sub">Ordenadas por urgencia y por cuánto llevan esperando</p>${B.cola.length?B.cola.map(filaCaso).join(""):'<p class="muted">No tienes solicitudes por revisar.</p>'}</section>
     <section class="gx-card"><h3>Cuánto llevan esperando</h3><p class="sub">Solicitudes por revisar según su antigüedad</p>${B.antiguedad.map((x,i)=>`<div class="px-bar"><span class="n">${esc(x.etiqueta)}</span><span class="t"><i class="${["","","am","ro"][i]}" style="width:${Math.round(x.n/maxA*100)}%"></i></span><b>${esc(x.n)}</b></div>`).join("")}
       <p class="px-nota">${B.antiguedad[3].n?`⚠ ${B.antiguedad[3].n} ${B.antiguedad[3].n===1?"lleva":"llevan"} más de 15 días: conviene priorizar.`:"Nada con más de 15 días de espera."}</p></section>
   </div>
   <div class="px-2">
     <section class="gx-card"><h3>Dónde está tu trabajo</h3><p class="sub">Todas tus solicitudes según su etapa</p>
       <div class="px-dona"><div class="px-pie" style="background:conic-gradient(${B.total?cono:"#E8ECF6 0 100%"})"><b>${B.total}</b><span>solicitudes</span></div>
       <ul class="px-leg">${seg.map(([c,n,t])=>`<li><i style="background:${c}"></i>${t}<b>${n}</b></li>`).join("")}</ul></div></section>
     <section class="gx-card"><h3>Por movimiento</h3><p class="sub">Qué te están pidiendo más</p>${barraPx("",B.porMovimiento)}</section>
   </div>`;
}

$("tabs").onclick=e=>e.target.dataset.v&&cargar(e.target.dataset.v);
$("app").onclick=e=>{const t=e.target;
  if(t.id==="xls")return descargar();
  const ver=t.closest("[data-ver]");if(ver)return detalle(ver.dataset.ver);
  const fb=t.closest("[data-f]");   // tarjetas, barras y fichas del tablero filtran la bandeja; pulsar de nuevo quita el filtro
  if(fb){const i=fb.dataset.f.indexOf(":"),k=fb.dataset.f.slice(0,i),v=fb.dataset.f.slice(i+1);
    if(k==="limpiar")Object.assign(filtro,{q:"",estado:"",movimiento:"",departamento:"",bp:"",atencion:""});else{filtro[k]=filtro[k]===v?"":v;if(k==="estado"&&filtro.estado)filtro.atencion="";if(k==="atencion"&&filtro.atencion)filtro.estado=""}
    pintar();const bj=$("bandeja");if(bj&&k!=="limpiar")bj.scrollIntoView({behavior:"smooth",block:"start"});return}
  const tr=t.closest("tr.f");if(tr)detalle(tr.dataset.id)};
$("app").oninput=e=>{if(e.target.id==="fq"){filtro.q=e.target.value;const p=e.target.selectionStart;pintar();$("fq").focus();$("fq").setSelectionRange(p,p)}};
$("app").onchange=e=>{if(e.target.id==="fe"){filtro.estado=e.target.value;pintar()}if(e.target.id==="fp"){filtro.periodo=e.target.value;filtro.periodoElegido=true;pintar()}};

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
  bp:[["Guardar observación",null,"sec",false,"Observación guardada",false],["Devolver al jefe","Devuelto al jefe","warn",true,"Solicitud devuelta al jefe",false],["Pausar","En pausa","sec",false,"Solicitud en pausa",false],["Derivar a otro BP",null,"sec",false,"",false],["Escalar a Gerencia ➜","Enviado a Gerencia","ok",false,"Solicitud escalada: ya está en la bandeja de Gerencia",true]],
  gerencia:[["Guardar comentario",null,"sec",false,"Comentario guardado",false],["Devolver al BP","En revisión BP","warn",true,"Solicitud devuelta al Business Partner",false],["Rechazar","Rechazado","bad",true,"Solicitud rechazada",true],["Aprobar ✓","Aprobado","ok",false,"Solicitud aprobada",true]]
};
function detalle(id){
  const f=D.filas.find(x=>x.id===id),ed=D.editables.includes(f.estado||"Nuevo");
  google.script.run.withFailureHandler(fail).withSuccessHandler(d=>{
    const p=Number(d.puntaje),nivel=p>=85?"alto":p>=60?"medio":"bajo",previos=[["Business Partner",f.comentarioBP],["Gerencia",f.comentarioGerencia]].filter(x=>x[1]);
    const tg=d.registro&&d.registro.textoGerencia,auto=!tg&&d.registro&&vista==="gerencia"?redactar(d.registro,{comentarioBP:f.comentarioBP}):null;
    $("dlg").innerHTML=`
     <div class="dh"><div><span class="mov">${esc(f.movimiento)}</span><h2>${esc(f.colaborador)}</h2>
       <div class="meta"><span class="tag ${esc(f.estado)}">${esc(f.estado||"Nuevo")}</span><span>${esc(f.fechaSolicitud)}</span><span class="id">${esc(f.id)}</span></div></div>
       <button type="button" class="x" id="cerrarX" aria-label="Cerrar">✕</button></div>
     <div class="db">
      ${tg||auto?`<section class="sec"><h4>Texto para Gerencia <span class="orig">${tg?(d.registro.textoOrigen==="motor+editado"?"· redactado por el motor y editado por el Business Partner":"· redactado por el motor"):"· generado al abrir, aún sin revisión del Business Partner"}</span></h4><pre class="texto">${esc(tg||auto.texto)}</pre></section>`:""}
      <section class="sec"><h4>Resumen</h4><div class="grid">
        ${fila("Líder solicitante",f.cliente+" · "+f.cargoCliente)}${fila("Departamento",f.departamento)}${fila("Área",f.area)}${fila("Sección",f.seccion)}
        ${fila("Matrícula",f.codigo)}${fila("Puesto actual",f.puestoActual)}${fila("Business Partner",f.bp)}${fila("Derivada por",f.derivadoPor)}${fila("Urgencia",f.urgencia)}
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
    const aplicar=(estado,coment,extra,ok)=>{dlg.querySelectorAll("button").forEach(x=>x.disabled=true);
      google.script.run.withFailureHandler(e=>{dlg.querySelectorAll("button").forEach(x=>x.disabled=false);aviso(e.message||e)}).withSuccessHandler(()=>{dlg.close();cargar(vista);aviso("✓ "+ok)}).panelActualizar(id,vista,estado,coment,extra)};
    // Escalar: el BP revisa (y puede editar) el texto que recibirá Gerencia; el motor señala lo que falta o no cuadra.
    const componer=coment=>{
      const base=redactar(d.registro,{comentarioBP:coment});
      dlg.innerHTML=`<div class="dh"><div><span class="mov">Escalar a Gerencia</span><h2>Texto para Gerencia</h2><div class="meta"><span>Armado con las respuestas del jefe: revísalo y edítalo antes de enviar</span></div></div><button type="button" class="x" id="cerrarX2" aria-label="Cerrar">✕</button></div>
       <div class="db">${base.alertas.length?`<section class="sec"><h4>Puntos a validar antes de enviar (${base.alertas.length})</h4><ul class="ptos">${base.alertas.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></section>`:'<section class="sec good">Sin puntos pendientes: los datos mínimos están completos.</section>'}
        <section class="sec"><h4>Texto que recibirá Gerencia</h4><textarea id="tg" class="tg" rows="20" spellcheck="true">${esc(base.texto)}</textarea><p class="muted">Cada dato sale de las respuestas del formulario. Si lo editas, queda registrado como «editado por el Business Partner».</p></section></div>
       <div class="df"><div class="acts"><button type="button" class="btn sec" id="volver">← Volver al detalle</button><button type="button" class="btn sec" id="regenerar">Regenerar</button><span class="sp"></span><button type="button" class="btn ok" id="enviarG">Enviar a Gerencia ➜</button></div></div>`;
      $("cerrarX2").onclick=()=>dlg.close();$("volver").onclick=()=>detalle(id);
      $("regenerar").onclick=()=>{$("tg").value=base.texto;aviso("Texto regenerado desde los datos")};
      $("enviarG").onclick=()=>{const t=$("tg").value.trim();if(t.length<30)return aviso("El texto está vacío");
        if(!confirm("¿Enviar a Gerencia con este texto? Esta acción se registra a tu nombre."))return;
        aplicar("Enviado a Gerencia",coment,{textoGerencia:t,textoOrigen:t===base.texto.trim()?"motor":"motor+editado"},"Solicitud escalada: ya está en la bandeja de Gerencia")};
    };
    // Derivar: pasa la solicitud a otro Business Partner (el actual deja de verla; el otro la recibe marcada como derivada).
    const derivar=async coment=>{
      const n=await nombres(),otros=Object.entries(n).filter(([k])=>k!==D.bpId).sort((a,b)=>a[1].localeCompare(b[1]));
      if(!otros.length)return aviso("No hay otros Business Partner disponibles");
      dlg.innerHTML=`<div class="dh"><div><span class="mov">Derivar</span><h2>¿A qué Business Partner la derivas?</h2><div class="meta"><span>Dejarás de verla; el otro Business Partner la recibe en su bandeja</span></div></div><button type="button" class="x" id="cerrarX3" aria-label="Cerrar">✕</button></div>
       <div class="db"><section class="sec"><h4>Business Partner destino</h4><div class="ops">${otros.map(([k,nom])=>`<label class="op"><input type="radio" name="dest" value="${esc(k)}"><span>${esc(nom)}</span></label>`).join("")}</div></section>
        <section class="sec"><h4>Motivo de la derivación</h4><textarea id="motivo" rows="3" style="width:100%" placeholder="Por qué la derivas (lo verá quien la reciba)">${esc(coment)}</textarea></section></div>
       <div class="df"><div class="acts"><button type="button" class="btn sec" id="volver3">← Volver al detalle</button><span class="sp"></span><button type="button" class="btn ok" id="derivarOk">Derivar</button></div></div>`;
      $("cerrarX3").onclick=()=>dlg.close();$("volver3").onclick=()=>detalle(id);
      $("derivarOk").onclick=()=>{const dest=dlg.querySelector("input[name=dest]:checked"),motivo=$("motivo").value.trim();
        if(!dest)return aviso("Elige a quién derivarla");
        if(motivo.length<5){$("motivo").focus();return aviso("Escribe el motivo de la derivación")}
        const nom=n[dest.value];if(!confirm(`¿Derivar esta solicitud a ${nom}? Dejarás de verla.`))return;
        aplicar("En revisión BP",motivo,{derivarA:dest.value},"Solicitud derivada a "+nom)};
    };
    if(ed)dlg.querySelectorAll("[data-i]").forEach(b=>b.onclick=()=>{
      const [txt,nuevo,,exige,ok,confirma]=ACCIONES[vista][b.dataset.i],coment=$("nc").value.trim();
      const estado=nuevo||(D.estados.includes(f.estado)?f.estado:D.estados[0]);
      if(exige&&!coment){$("nc").focus();$("nc").classList.add("falta");return aviso("Escribe una observación para continuar")}
      if(vista==="bp"&&txt==="Derivar a otro BP")return derivar(coment);
      if(vista==="bp"&&nuevo==="Enviado a Gerencia")return componer(coment);
      if(confirma&&!confirm(`¿${txt.replace(/[➜✓]/g,"").trim()}? Esta acción se registra a tu nombre.`))return;
      aplicar(estado,coment,null,ok)});
  }).panelDetalle(id,vista,TOKEN);
}
// Cierre por inactividad: el panel muestra datos de personas; en un equipo compartido la sesión no debe quedar abierta.
const INACTIVO_MIN=30;let ultimo=Date.now();
["click","keydown","input","scroll"].forEach(ev=>addEventListener(ev,()=>{ultimo=Date.now()},{passive:true}));
setInterval(async()=>{if(Date.now()-ultimo>INACTIVO_MIN*60000&&await FB.usuario()){await FB.signOut(FB.auth);TOKEN=null;mostrarLogin(new Error("Tu sesión se cerró por inactividad. Ingresa de nuevo."))}},30000);
google.script.run.withFailureHandler(mostrarLogin).withSuccessHandler(q=>cargar(q.vistas[q.vistas.length-1])).panelQuien();

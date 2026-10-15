import * as FB from "./firebase.js";
import { redactar } from "./redactor.mjs";
import { metricas, aplicarFiltros, prioridad, movimientoPorEstado, tendencia, lecturas, metricasBP, histogramaPuntaje, mapaCalor, porSemana, urgenciaPendientes } from "./tablero.mjs";   // indicadores del tablero de Gerencia   // motor de redacción ejecutiva (determinista)
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
// Contacto del jefe solicitante (para el corte y el detalle): correo institucional verificado de quien envió la solicitud.
const correoJefe=v=>String(v||"").replace(/\+jefe(?=@)/,"").toLowerCase().trim();   // «usuario+jefe@» es la cuenta de formulario de un socio de negocio: su buzón es «usuario@»
const mailto=c=>{c=correoJefe(c);return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c)?`<a class="mt" href="mailto:${esc(c)}">${esc(c)}</a>`:""};
const lineaJefe=(n,cargo,c)=>`<div class="pr-jefe"><span class="pr-jefe-t">Jefe solicitante</span><b>${esc(n||"—")}</b>${cargo?` · ${esc(cargo)}`:""}${mailto(c)?` · ${mailto(c)}`:""}</div>`;
const plano=(d,extra)=>{const o={};Object.entries(d).forEach(([k,v])=>{if(extra||!SIN.has(k))o[k]=v});return o};
const pares=d=>(d.levantamiento||[]).map(x=>[x.p,x.r]);
const nombres=async()=>{if(!nombres.c){nombres.c={};(await FB.getDocs(FB.collection(FB.db,"bps"))).forEach(d=>{nombres.c[d.id]=d.data().nombre})}return nombres.c};
const filas=async(vista,q)=>{
  if(!CFG[vista]||!q.vistas.includes(vista))throw new Error("Sin acceso a esta vista");
  const c=FB.collection(FB.db,"solicitudes");
  if(vista==="bp"&&!q.bpId)throw new Error("Tu cuenta no tiene un Socio de negocio asignado.");
  const [docs,n]=await Promise.all([FB.getDocs(vista==="bp"?FB.query(c,FB.where("bpId","==",q.bpId)):FB.query(c,FB.where("estado","in",VISIBLE_GER))),nombres()]);
  return docs.docs.map(d=>({...d.data(),bp:n[d.data().bpId]||"—",derivadoPor:d.data().derivadoDe?(n[d.data().derivadoDe]||"otro BP"):""}));
};
const API={
  // Cada Socio de negocio / Gerencia crea su propia cuenta con su correo y la clave que elija; el correo se confirma con un enlace.
  // Solo entran los correos que el administrador autorizó (documento roles/{correo}); una cuenta sin autorización no ve nada.
  async panelCrear(email,clave,clave2){
    email=FB.normalizar(email);
    if(!/^[^@\s]+@(usil\.edu\.pe|usil\.pe|epg\.usil\.pe|sir\.pe|sir\.edu\.pe|institutoemprendedores\.pe|institutoemprendedores\.edu\.pe)$/i.test(email))throw new Error("Usa tu correo institucional de USIL.");
    if(String(clave).length<12)throw new Error("Tu clave debe tener 12 o más caracteres.");
    if(clave!==clave2)throw new Error("Las dos claves no coinciden.");
    let u;
    try{await FB.setPersistence(FB.auth,FB.browserSessionPersistence);u=(await FB.createUserWithEmailAndPassword(FB.auth,email,clave)).user}
    catch(e){throw new Error(e.code==="auth/email-already-in-use"?"Ese correo ya tiene cuenta: entra con tu clave. Si no la recuerdas, pide que te la restablezcan.":e.code==="auth/weak-password"?"Esa clave es demasiado débil.":"No se pudo crear la cuenta. Intenta de nuevo.")}
    try{await FB.sendEmailVerification(u)}finally{await FB.signOut(FB.auth)}
    return {mensaje:"Cuenta creada. Te enviamos un enlace a "+email+": ábrelo para confirmar tu correo y luego entra con tu clave."};
  },
  async panelEntrar(email,clave){
    try{await FB.setPersistence(FB.auth,FB.browserSessionPersistence);await FB.signInWithEmailAndPassword(FB.auth,FB.normalizar(email),String(clave))}catch(e){throw new Error(FB.mensajeAcceso(e.code))}
    return sesion();
  },
  panelQuien:sesion,
  async panelDatos(vista){const q=await sesion();return {email:q.email,bpId:q.bpId,vistas:q.vistas,vista,filas:(await filas(vista,q)).map(d=>plano(d)),estados:CFG[vista].estados,editables:CFG[vista].editables}},
  async panelExportar(vista){return (await filas(vista,await sesion())).map(d=>({...plano(d),levantamiento:pares(d),aprobaciones:d.aprobaciones||[]}))},
  async panelDetalle(id,vista){
    await sesion();const s=await FB.getDoc(FB.doc(FB.db,"solicitudes",id));if(!s.exists())throw new Error("Solicitud no disponible");const d=s.data();
    // El monto del presupuesto vive aparte (el jefe no lo puede leer) y la trazabilidad se consulta por solicitud: si alguna lectura no se permite, el detalle sale igual.
    const [presupuestoInterno,traza]=await Promise.all([
      FB.getDoc(FB.doc(FB.db,"solicitudes",id,"interno","presupuesto")).then(x=>x.exists()?x.data():null).catch(()=>null),
      FB.getDocs(FB.query(FB.collection(FB.db,"eventos"),FB.where("solicitudId","==",id))).then(r=>r.docs.map(x=>x.data()).sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)))).catch(()=>[])]);
    return {presupuestoInterno,traza,puntaje:d.puntaje,clasificacion:d.clasificacion,fortalezas:d.fortalezas,alertas:d.alertas,recomendacion:d.recomendacion,registro:plano(d,true),sustento:d.solicitudConcreta,impacto:d.impactoDetalle,editUrl:"",levantamiento:pares(d),aprobaciones:d.aprobaciones||[]};
  },
  async panelEventos(vista){
    const q=await sesion();if(!CFG[vista]||!q.vistas.includes(vista))throw new Error("Sin acceso");
    const c=FB.collection(FB.db,"eventos");
    const r=await FB.getDocs(vista==="bp"?FB.query(c,FB.where("bpId","==",q.bpId)):c);
    return r.docs.map(d=>d.data()).sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)));
  },
  async panelCortes(){
    const q=await sesion();if(!q.vistas.includes("gerencia"))throw new Error("Sin acceso a los cortes");
    return (await FB.getDocs(FB.collection(FB.db,"cortes"))).docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(b.creadoEl).localeCompare(String(a.creadoEl)));
  },
  async panelCrearCorte(titulo,nota,fechaCorte,ids){
    const q=await sesion();if(!q.vistas.includes("gerencia"))throw new Error("Sin acceso a los cortes");
    ids=[...new Set(ids)].slice(0,100);if(!ids.length)throw new Error("No hay casos para el corte.");
    const [docs,n]=await Promise.all([Promise.all(ids.map(id=>FB.getDoc(FB.doc(FB.db,"solicitudes",id)))),nombres()]);
    const t=v=>String(v==null?"":v);
    const casos=docs.filter(s=>s.exists()).map(s=>{const d=s.data();return {id:s.id,colaborador:t(d.colaborador),movimiento:t(d.movimiento),departamento:t(d.departamento),area:t(d.area),cliente:t(d.cliente),cargoCliente:t(d.cargoCliente),correoCliente:correoJefe(d.enviadoPor),
      bp:t(n[d.bpId]),urgencia:t(d.urgencia),impacto:t(d.impacto),puntaje:t(d.puntaje),estado:t(d.estado),fechaSolicitud:t(d.fechaSolicitud),sustento:t(d.solicitudConcreta).slice(0,1500),texto:t(d.textoGerencia||redactar(d,{comentarioBP:d.comentarioBP}).texto).slice(0,3500)}});
    const pts=casos.map(c=>Number(c.puntaje)).filter(x=>x>0),pm={};casos.forEach(c=>{pm[c.movimiento]=(pm[c.movimiento]||0)+1});
    const corte={titulo:t(titulo).slice(0,120),nota:t(nota).slice(0,1000),fechaCorte:t(fechaCorte),creadoPor:q.email,creadoEl:new Date().toISOString(),casos,
      resumen:{total:casos.length,urgentes:casos.filter(c=>["Inmediato","Dentro de 30 días"].includes(c.urgencia)).length,preparacion:pts.length?Math.round(pts.reduce((a,b)=>a+b,0)/pts.length):0,porMovimiento:Object.entries(pm).map(([m,k])=>({m,n:k}))}};
    const ref=FB.doc(FB.collection(FB.db,"cortes"));await FB.setDoc(ref,corte);return {id:ref.id,...corte};
  },
  async panelActualizar(id,vista,estado,comentario,extra){
    const q=await sesion();if(!CFG[vista]||!CFG[vista].estados.includes(estado))throw new Error("Estado no permitido");
    const cambios={estado,[CFG[vista].campo]:String(comentario||"").slice(0,1000),gestionadoPor:q.email,gestionadoEl:new Date().toISOString()};let pres=null;
    if(vista==="bp"&&extra&&typeof extra==="object"){
      if(extra.textoGerencia!=null){cambios.textoGerencia=String(extra.textoGerencia).slice(0,20000);cambios.textoOrigen=String(extra.textoOrigen||"").slice(0,30)}
      if(extra.derivarA){if(extra.derivarA===q.bpId)throw new Error("Elige a otro Socio de negocio.");cambios.bpId=String(extra.derivarA);cambios.derivadoDe=q.bpId;cambios.estado="En revisión BP"}   // pasa a la bandeja de otro BP
      // Presupuesto: «¿hay?» (Sí/No) es lo único que ve el jefe; el monto y la nota quedan en un documento aparte que solo leen el HRBP y Gerencia.
      if(extra.presupuestoConfirmado!=null&&extra.presupuestoConfirmado!==""){if(!["Sí","No"].includes(extra.presupuestoConfirmado))throw new Error("El presupuesto se confirma con Sí o No.");cambios.presupuestoConfirmado=extra.presupuestoConfirmado}
      if(extra.presupuestoMonto!=null)pres={monto:String(extra.presupuestoMonto).trim().slice(0,60),nota:String(extra.presupuestoNota||"").trim().slice(0,300),por:q.email,fecha:cambios.gestionadoEl};
    }
    // Todo en UN lote: el cambio, el evento (con correos, para HRBP y Gerencia), la traza que ve el jefe (solo el rol) y, si el HRBP lo llenó, el monto del presupuesto.
    // O pasa todo o no pasa nada: la trazabilidad no puede quedar a medias.
    const ref=FB.doc(FB.db,"solicitudes",id);let previo;
    try{previo=(await FB.getDoc(ref)).data()}catch(e){throw new Error(e.code==="permission-denied"?"Esta solicitud ya no está en tu etapa.":e.message)}
    const de=String(previo.estado||"Nuevo"),bpAhora=cambios.bpId||previo.bpId||"",nota=String(cambios[CFG[vista].campo]||"").slice(0,1000);
    const tipo=cambios.derivadoDe?"Derivación":cambios.textoGerencia!=null?"Escalada a Gerencia":de!==cambios.estado?"Cambio de estado":"Comentario";
    let notaEvento=nota;if(cambios.derivadoDe){const n=await nombres();notaEvento=`Derivada de ${n[cambios.derivadoDe]||"—"} a ${n[cambios.bpId]||"—"}: ${nota}`.slice(0,1000)}   // los nombres de los socios solo van en el evento interno, nunca en lo que ve el jefe
    const lote=FB.writeBatch(FB.db);
    lote.update(ref,cambios);
    lote.set(FB.doc(FB.collection(FB.db,"eventos")),{solicitudId:id,bpId:bpAhora,tipo,de,a:cambios.estado,por:q.email,rol:vista,fecha:cambios.gestionadoEl,comentario:notaEvento});
    if(tipo!=="Comentario"){   // al jefe le llegan los cambios de etapa, no las notas internas; el comentario solo cuando es para él (devolución del socio o decisión de Gerencia)
      const paraJefe=(vista==="bp"&&cambios.estado==="Devuelto al jefe")||(vista==="gerencia"&&["Aprobado","Rechazado"].includes(cambios.estado));
      lote.set(FB.doc(FB.collection(FB.db,"trazas")),{solicitudId:id,uid:previo.uid,tipo,de,a:cambios.estado,rol:vista,fecha:cambios.gestionadoEl,comentario:paraJefe?nota:""});
    }
    if(pres)lote.set(FB.doc(ref,"interno","presupuesto"),pres);
    try{await lote.commit()}
    catch(e){throw new Error(e.code==="permission-denied"?"Esta solicitud ya no está en tu etapa.":e.message)}
    return {ok:true};
  }
};
// Misma interfaz que google.script.run de Apps Script, para no tocar el resto del panel.
const mk=(ok,ko)=>new Proxy({},{get:(_,k)=>k==="withSuccessHandler"?f=>mk(f,ko):k==="withFailureHandler"?f=>mk(ok,f):(...a)=>API[k](...a).then(d=>ok&&ok(d),e=>ko&&ko(e))});
const google={script:{run:mk()}};
// Capturas de la confirmación del jefe aprobador (subcolección «evidencias»): se pintan con DOM, nunca con innerHTML, y solo si son un JPEG en base64.
const evidencias=async id=>{
  const c=$("evid");if(!c)return;
  try{
    const r=await FB.getDocs(FB.collection(FB.db,"solicitudes",id,"evidencias"));
    const imgs=r.docs.sort((a,b)=>a.id.localeCompare(b.id)).map(x=>x.data().img).filter(u=>/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(u||""));
    c.textContent=imgs.length?"":"Sin captura adjunta.";
    imgs.forEach((u,i)=>{const im=document.createElement("img");im.src=u;im.alt="Captura de la confirmación "+(i+1);im.title="Clic para ampliar";im.className="evid-img";im.onclick=()=>im.classList.toggle("grande");c.append(im)});
  }catch(e){c.textContent="No se pudo cargar la captura."}
};
const TITULOS={jefe:"Mis solicitudes",bp:"Bandeja del Socio de negocio",gerencia:"Gerencia · vista final"};
const ALL=["Nuevo","En revisión BP","Devuelto al jefe","Enviado a Gerencia","Aprobado","Rechazado","En pausa"];
let D=null,vista=null,filtro={q:"",estado:"",periodo:"",movimiento:"",departamento:"",bp:"",atencion:""};
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let TOKEN=null;
const fail=e=>{const m=(e&&e.message||e)+"";if(/venci/.test(m)){TOKEN=null;return mostrarLogin(e)}$("err").hidden=false;$("err").textContent=m;$("app").innerHTML=""};
$("salir").onclick=async()=>{await FB.signOut(FB.auth);TOKEN=null;PRES=null;SEL.clear();mostrarLogin()};
const TEXTOS={
  entrar:["Panel de revisión","Entra con tu correo de USIL y tu clave (Socio de negocio o Gerencia).","Entrar"],
  crear:["Crear cuenta","Primera vez: usa tu correo institucional autorizado y elige tu clave (12 o más caracteres). Te enviaremos un enlace para confirmar tu correo.","Crear cuenta"]};
function mostrarLogin(e,modo){
  document.body.classList.add("entrar");   // fondo de la pantalla de ingreso
  modo=TEXTOS[modo]?modo:"entrar";
  $("err").hidden=true;$("tabs").innerHTML="";$("quien").textContent="";$("salir").style.display="none";
  const m=(e&&e.message||"")+"",[titulo,ayuda,boton]=TEXTOS[modo];
  const campo=(id,tipo,ph,ac)=>'<p><input id="'+id+'" type="'+tipo+'" autocomplete="'+ac+'" autocapitalize="none" spellcheck="false" placeholder="'+ph+'" style="width:100%"></p>';
  $("app").innerHTML='<form id="lg" novalidate class="card" style="max-width:400px;margin:95px auto"><h3 style="margin-top:0;color:var(--navy)">'+titulo+'</h3><p class="muted">'+ayuda+'</p><p id="lgm" style="color:#B00020">'+(/Inicia sesi|venci|Estás con/.test(m)?"":esc(m))+'</p>'+
    campo("lgc","text","usuario@usil.edu.pe","username")+campo("lgk","password",modo==="crear"?"Elige tu clave (12 o más caracteres)":"Clave",modo==="crear"?"new-password":"current-password")+(modo==="crear"?campo("lgk2","password","Repite tu clave","new-password"):"")+
    '<button class="p" style="width:100%">'+boton+'</button><p class="lnks">'+(modo==="entrar"?'<a class="lnk" href="index.html" style="margin-left:auto">← Regresar al inicio</a>':'<button type="button" class="lnk" data-m="entrar">← Volver a entrar</button>')+'</p></form>';
  $("lg").querySelectorAll(".lnk[data-m]").forEach(x=>x.onclick=()=>mostrarLogin(null,x.dataset.m));
  const dec=(txt,bien)=>{$("lgm").textContent=txt;$("lgm").style.color=bien?"#17844A":"#B00020"};
  $("lg").onsubmit=ev=>{ev.preventDefault();dec("");const b=$("lg").querySelector("button.p");b.disabled=true;const fin=()=>{b.disabled=false};
    const fallo=x=>{dec(x.message||x);fin()};
    if(modo==="entrar")google.script.run.withFailureHandler(fallo).withSuccessHandler(r=>{TOKEN=r.token;cargar(r.vistas[r.vistas.length-1])}).panelEntrar($("lgc").value,$("lgk").value);
    else google.script.run.withFailureHandler(fallo).withSuccessHandler(r=>{dec(r.mensaje,true);$("lgk").value=$("lgk2").value="";fin()}).panelCrear($("lgc").value,$("lgk").value,$("lgk2").value)};
}

function cargar(v){
  vista=v;$("app").innerHTML='<p class="muted">Cargando…</p>';$("err").hidden=true;
  google.script.run.withFailureHandler(fail).withSuccessHandler(d=>{D=d;pintar()}).panelDatos(v,TOKEN);
}
function contar(filas,k){const m={};filas.forEach(f=>{const x=f[k]||"—";m[x]=(m[x]||0)+1});return Object.entries(m).sort((a,b)=>b[1]-a[1])}
function barras(t,pares){const max=Math.max(1,...pares.map(p=>p[1]));
  return `<div class="card"><b>${t}</b>${pares.slice(0,8).map(([k,n])=>`<div class="bar"><span title="${esc(k)}">${esc(k)}</span><i style="width:${n/max*100}px"></i><span>${n}</span></div>`).join("")}</div>`}
function visibles(){const q=filtro.q.toLowerCase();
  return D.filas.filter(f=>(!filtro.estado||(filtro.estado==="Por revisar"?["Nuevo","En revisión BP"].includes(f.estado||"Nuevo"):f.estado===filtro.estado))&&(!filtro.movimiento||f.movimiento===filtro.movimiento)&&(!filtro.periodo||f.periodo===filtro.periodo)&&(!q||Object.values(f).join(" ").toLowerCase().includes(q)))
    .sort((a,b)=>String(b.enviadoEl).localeCompare(String(a.enviadoEl)))}
function pintar(){
  document.body.classList.remove("entrar");$("quien").textContent=D.email;$("salir").style.display="";
  $("tabs").innerHTML=D.vistas.map(v=>`<button class="${v===vista?"on":""}" data-v="${v}">${TITULOS[v]}</button>`).join("");
  if(vista==="gerencia")return PRES?pintarPresentacion():pintarGerencia();
  const F=D.filas,pend=F.filter(f=>(vista==="gerencia"?["Enviado a Gerencia"]:["Nuevo","En revisión BP"]).includes(f.estado||"Nuevo")).length;
  let h=vista==="bp"?pintarBP(F):`<div class="kpis"><div class="card kpi"><b>${F.length}</b><span>Solicitudes</span></div><div class="card kpi"><b>${pend}</b><span>Por revisar</span></div>
   <div class="card kpi"><b>${F.filter(f=>f.estado==="Aprobado").length}</b><span>Aprobadas</span></div><div class="card kpi"><b>${F.filter(f=>f.estado==="Rechazado").length}</b><span>Rechazadas</span></div></div>`;
  if(vista==="gerencia")h+=`<div class="row">${barras("Por estado",contar(F,"estado"))}${barras("Por Socio de negocio",contar(F,"bp"))}${barras("Por movimiento",contar(F,"movimiento"))}${barras("Por departamento",contar(F,"departamento"))}${barras("Por urgencia",contar(F,"urgencia"))}</div>`;
  if(vista==="bp"){$("app").innerHTML=h+tablaBandeja(F,visibles(),"bp");return}
  const per=[...new Set(F.map(f=>f.periodo).filter(Boolean))].sort().reverse();
  h+=`<div class="tools"><input id="fq" placeholder="Buscar…" value="${esc(filtro.q)}"><select id="fe"><option value="">Todos los estados</option>${ALL.map(e=>`<option ${e===filtro.estado?"selected":""}>${esc(e)}</option>`).join("")}</select>
   ${vista!=="jefe"?'<button class="p" id="xls" style="margin-left:auto">⬇ Descargar Excel</button>':""}<select id="fp"><option value="">Todos los periodos</option>${per.map(p=>`<option ${p===filtro.periodo?"selected":""}>${esc(p)}</option>`).join("")}</select></div>`;
  const V=visibles();
  h+=`<div class="wrap"><table><tr><th>Fecha</th><th>Movimiento</th><th>Colaborador</th><th>Departamento</th>${vista!=="jefe"?"<th>Líder</th>":""}<th>Socio de negocio</th><th>Urgencia</th><th>Puntaje</th><th>Estado</th></tr>
  ${V.map(f=>`<tr class="f" data-id="${esc(f.id)}"><td>${esc(f.fechaSolicitud)}</td><td>${esc(f.movimiento)}</td><td>${esc(f.colaborador)}</td><td>${esc(f.departamento)}</td>${vista!=="jefe"?`<td>${esc(f.cliente)}</td>`:""}<td>${esc(f.bp)}</td><td>${esc(f.urgencia)}</td><td>${esc(f.puntaje||"—")}</td><td><span class="tag ${esc(f.estado)}">${esc(eb(f.estado||"Nuevo"))}</span>${f.derivadoPor?` <span class="pill u3" title="Derivada por otro Socio de negocio">↪ ${esc(f.derivadoPor)}</span>`:""}</td></tr>`).join("")||'<tr><td colspan="9" class="muted">Sin solicitudes.</td></tr>'}</table></div>`;
  $("app").innerHTML=h;
}
// ---------- Tablero gerencial (vista de Gerencia): indicadores, flujo, casos que requieren atención, gráficos y bandeja ----------
const MESES=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const periodoTxt=p=>p?(MESES[+String(p).slice(5)-1]||"?").replace(/^./,c=>c.toUpperCase())+" "+String(p).slice(0,4):"Todos los periodos";
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
const btnG=()=>`<button type="button" class="px-tog" id="togG">${$("app").classList.contains("sin-g")?"Mostrar gráficas":"Ocultar gráficas"}</button>`;
try{if(sessionStorage.getItem("px-sin-g")==="1")$("app").classList.add("sin-g")}catch(e){}
const eb=s=>String(s==null?"":s).replace("En revisión BP","En revisión");
const iniciales=n=>String(n||"?").trim().split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase();
const nivelP=p=>p>=85?"alto":p>=60?"medio":"bajo";
const edad=d=>d==null?"":d===0?"hoy":d===1?"hace 1 día":`hace ${d} días`;
const mesCorto=p=>{p=String(p);return (MESES[+p.slice(5)-1]||"?").slice(0,3).replace(/^./,c=>c.toUpperCase())+" "+p.slice(2,4)};
/** Fila de un caso que pide acción: abre el detalle. */
const filaCaso=f=>`<button type="button" class="px-row" data-ver="${esc(f.id)}"><i class="px-av">${esc(iniciales(f.colaborador))}</i>
  <span class="px-mn"><b>${esc(f.colaborador||"—")}</b><em>${esc(f.movimiento)} · ${esc(f.departamento)}</em></span>
  <span class="pill ${PILL_U[f.urgencia]||"u4"}">${esc(f.urgencia||"—")}</span>${f.dias!=null?`<small class="px-ed">${edad(f.dias)}</small>`:""}
  ${f.puntaje?`<span class="px-sc ${nivelP(+f.puntaje)}" title="Preparación del caso">${esc(f.puntaje)}</span>`:""}</button>`;
const chipsPeriodo=pers=>{const asc=pers.slice().reverse(),vis=filtro.verMas?asc:asc.slice(-4),ocultos=asc.length-vis.length;
  return `<div class="px-pers"><span>Periodo</span><button type="button" class="px-pc${filtro.periodo===""?" on":""}" data-f="periodo:">Todos</button>${ocultos>0||filtro.verMas?`<button type="button" class="px-pc mas" data-f="verMas:1">${filtro.verMas?"Menos ›":`‹ ${ocultos} más atrás`}</button>`:""}${vis.map(x=>`<button type="button" class="px-pc${filtro.periodo===x?" on":""}" data-f="periodo:${esc(x)}">${esc(mesCorto(x))}</button>`).join("")}</div>`};
const onF=f=>{if(!f)return"";const i=f.indexOf(":");return filtro[f.slice(0,i)]===f.slice(i+1)?" on":""};
const kpiPx=(cl,n,t,s,f)=>`<button type="button" class="px-kpi ${cl}${onF(f)}" ${f?`data-f="${f}"`:""}><span>${t}</span><b>${esc(n)}</b><em>${s}</em></button>`;
const barraPx=(clave,pares)=>{const max=Math.max(1,...pares.map(x=>x[1]));return pares.length?pares.map(([k,n])=>`<button type="button" class="px-bar${clave&&filtro[clave]===k?" on":""}" ${clave?`data-f="${clave}:${esc(k)}"`:""}><span class="n" title="${esc(k)}">${esc(k)}</span><span class="t"><i style="width:${Math.round(n/max*100)}%"></i></span><b>${n}</b></button>`).join(""):'<p class="muted">Sin datos.</p>'};
function tablaBandeja(F,V,rol){
  const per=[...new Set(F.map(f=>f.periodo).filter(Boolean))].sort().reverse();
  return `<section class="gx-card" id="bandeja"><h3>${rol==="gerencia"?"Todas las solicitudes":"Bandeja completa"}</h3>
   <div class="tools"><input id="fq" placeholder="Buscar por colaborador, área o movimiento…" value="${esc(filtro.q)}" style="min-width:240px;flex:1"><select id="fe"><option value="">Todos los estados</option>${(rol==="gerencia"?["Enviado a Gerencia","Aprobado","Rechazado"]:["Por revisar",...ALL]).map(x=>`<option value="${esc(x)}"${x===filtro.estado?" selected":""}>${esc(eb(x))}</option>`).join("")}</select>
   ${rol==="gerencia"?"":`<select id="fp"><option value="">Todos los periodos</option>${per.map(p=>`<option ${p===filtro.periodo?"selected":""}>${esc(p)}</option>`).join("")}</select>`}<button class="p" id="xls">⬇ Descargar Excel</button><button class="p" id="trz">⬇ Trazabilidad</button></div>
   ${["periodo","movimiento","departamento","estado","atencion"].some(k=>filtro[k])?`<div class="tools">${["periodo","movimiento","departamento","estado","atencion"].filter(k=>filtro[k]).map(k=>`<button type="button" class="gx-chip" data-f="${k}:${esc(filtro[k])}">${esc(k==="periodo"?periodoTxt(filtro[k]):k==="atencion"?ETIQ[filtro[k]]:eb(filtro[k]))} ✕</button>`).join("")}<button type="button" class="gx-chip" data-f="limpiar:1">Limpiar filtros</button></div>`:""}
   ${rol==="gerencia"&&SEL.size?`<div class="px-selbar"><b>${SEL.size}</b> caso${SEL.size===1?"":"s"} seleccionado${SEL.size===1?"":"s"}<button type="button" class="px-tog corte" id="btnCorte">✂ Hacer corte con la selección</button><button type="button" class="gx-chip" id="limpiarSel">Quitar selección</button></div>`:""}
   <div class="wrap"><table><tr>${rol==="gerencia"?`<th class="csel"><input type="checkbox" class="sel" id="selTodo" title="Seleccionar lo visible"${V.length&&V.slice(0,100).every(f=>SEL.has(f.id))?" checked":""}></th>`:""}<th>Fecha</th><th>Colaborador</th><th>Movimiento</th><th>Departamento</th><th>Líder</th><th>Socio de negocio</th><th>Urgencia</th><th>Puntaje</th><th>Estado</th><th></th></tr>
   ${V.map(f=>`<tr class="f" data-id="${esc(f.id)}">${rol==="gerencia"?`<td class="csel"><input type="checkbox" class="sel" data-sel="${esc(f.id)}"${SEL.has(f.id)?" checked":""}></td>`:""}<td>${esc(f.fechaSolicitud)}</td><td>${esc(f.colaborador)}</td><td>${esc(f.movimiento)}</td><td>${esc(f.departamento)}</td><td>${esc(f.cliente)}</td><td>${esc(f.bp)}${f.derivadoPor?` <span class="pill u3" title="Derivada por otro Socio de negocio">↪ ${esc(f.derivadoPor)}</span>`:""}</td><td><span class="pill ${PILL_U[f.urgencia]||"u4"}">${esc(f.urgencia||"—")}</span></td><td>${esc(f.puntaje||"—")}</td><td><span class="pill ${PILL_E[f.estado]||"e0"}">${esc(eb(f.estado||"Nuevo"))}</span></td><td><button type="button" class="gx-ver" data-ver="${esc(f.id)}">Ver caso</button> <button type="button" class="gx-ver" data-trz="${esc(f.id)}" title="Descargar la trazabilidad de este caso">⬇ Trazabilidad</button></td></tr>`).join("")||'<tr><td colspan="10" class="muted">No hay solicitudes con estos filtros.</td></tr>'}</table></div></section>`;
}
function pintarGerencia(){
  const hoy=new Date(),todos=metricas(D.filas,"",hoy);
  if(!filtro.periodoElegido)filtro.periodo="";   // por defecto se ve todo lo cargado
  const sub=omit=>D.filas.filter(f=>["periodo","movimiento","departamento"].every(k=>omit.includes(k)||!filtro[k]||f[k]===filtro[k]));   // cada gráfica ignora su propio filtro para poder cambiar de barra
  const Fb=sub([]),M=metricas(Fb,"",hoy),A=M.atencion,V=aplicarFiltros(D.filas,filtro),Md=metricas(sub(["departamento"]),"",hoy);
  const urg=prioridad(Fb,hoy),mv=movimientoPorEstado(sub(["movimiento"])),tn=tendencia(sub(["periodo"])),maxT=Math.max(1,...tn.map(x=>x.total));
  const ls=lecturas(M,M.porMovimiento[0],M.porDepartamento[0]);
  $("app").innerHTML=`
   <div class="px-top"><div><span class="px-eyebrow">Gerencia · Decisión de movimientos</span><h2>Centro de decisiones</h2><p>Lo que necesitas para decidir y sustentar cada movimiento de talento</p></div>
     <div class="px-acc">${btnG()}<button type="button" class="px-tog corte" id="btnCorte">✂ Hacer corte</button><button type="button" class="px-tog sec" id="btnHist">Historial de cortes</button></div>${chipsPeriodo(todos.periodos)}</div>
   <section class="px-lectura px-graf"><i>✦</i><div><b>Lectura rápida</b><ul>${ls.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div></section>
   <div class="px-kpis">
     ${kpiPx("primario",M.pendientes,"Por decidir",A.masAntiguo==null?"Nada pendiente":`El más antiguo lleva ${A.masAntiguo} ${A.masAntiguo===1?"día":"días"}`,"atencion:pendientes")}
     ${kpiPx("verde",M.aprobadas,"Aprobadas",M.resueltas?Math.round(M.aprobadas/M.resueltas*100)+"% de lo resuelto":"—","estado:Aprobado")}
     ${kpiPx("rojo",M.rechazadas,"Rechazadas",M.resueltas?Math.round(M.rechazadas/M.resueltas*100)+"% de lo resuelto":"—","estado:Rechazado")}
     ${kpiPx("neutro",M.puntajePromedio==null?"—":M.puntajePromedio,"Preparación promedio",A.bajos?`${A.bajos} pendiente${A.bajos===1?"":"s"} con preparación baja`:"de 100 puntos","atencion:bajos")}
   </div>
   <div class="px-2 px-graf">
     <section class="gx-card"><h3>Para decidir ahora</h3><p class="sub">Primero lo más urgente y lo que más espera</p>${urg.length?urg.map(filaCaso).join(""):'<p class="muted">No hay casos pendientes. Todo está al día.</p>'}${M.pendientes>urg.length?`<button type="button" class="px-mas" data-f="atencion:pendientes">Ver los ${M.pendientes} pendientes →</button>`:""}</section>
     <section class="gx-card"><h3>Qué se está pidiendo</h3><p class="sub">Movimientos solicitados y cómo van</p>
       ${mv.length?mv.map(x=>`<button type="button" class="px-stk${filtro.movimiento===x.movimiento?" on":""}" data-f="movimiento:${esc(x.movimiento)}"><span class="n">${esc(x.movimiento)}</span><span class="t" style="width:${Math.round(x.total/mv[0].total*100)}%"><i class="pe" style="flex:${esc(x.pendientes)}"></i><i class="ap" style="flex:${esc(x.aprobadas)}"></i><i class="re" style="flex:${esc(x.rechazadas)}"></i></span><b>${esc(x.total)}</b></button>`).join(""):'<p class="muted">Sin datos.</p>'}
       <div class="px-leyenda"><span><i class="pe"></i>Por decidir</span><span><i class="ap"></i>Aprobadas</span><span><i class="re"></i>Rechazadas</span></div></section>
   </div>
   <div class="px-2 px-graf">
     <section class="gx-card"><h3>Evolución mensual</h3><p class="sub">Solicitudes recibidas por mes</p>
       ${tn.length?`<div class="px-cols">${tn.map(x=>`<button type="button" class="px-col${filtro.periodo===x.periodo?" on":""}" data-f="periodo:${esc(x.periodo)}" title="Ver solo ${esc(mesCorto(x.periodo))}"><b>${esc(x.total)}</b><span class="t"><i class="ap" style="height:${Math.round(x.aprobadas/maxT*100)}%"></i><i class="re" style="height:${Math.round(x.rechazadas/maxT*100)}%"></i><i class="pe" style="height:${Math.round((x.total-x.aprobadas-x.rechazadas)/maxT*100)}%"></i></span><em>${esc(mesCorto(x.periodo))}</em></button>`).join("")}</div>`:'<p class="muted">Sin datos.</p>'}</section>
     <section class="gx-card"><h3>Áreas que más piden</h3><p class="sub">Departamentos con más solicitudes</p>${barraPx("departamento",Md.porDepartamento.slice(0,6))}</section>
   </div>
   ${tablaBandeja(D.filas,V,"gerencia")}`;
}
function pintarBP(F0){
  const sub=omit=>F0.filter(f=>["periodo","movimiento"].every(k=>omit.includes(k)||!filtro[k]||f[k]===filtro[k])),F=sub([]),Bm=metricasBP(sub(["movimiento"]),new Date());
  const B=metricasBP(F,new Date()),tot=Math.max(1,B.total),maxA=Math.max(1,...B.antiguedad.map(y=>y.n));
  const seg=[["#F5B400",B.porRevisar,"Por revisar","Por revisar"],["#E07B39",B.devueltas,"Devueltas al jefe","Devuelto al jefe"],["#9AA6C4",B.enPausa,"En pausa","En pausa"],["#3B6BFF",B.enGerencia,"En Gerencia","Enviado a Gerencia"],["#1E9E5A",B.aprobadas,"Aprobadas","Aprobado"],["#D64545",B.rechazadas,"Rechazadas","Rechazado"]];
  let acc=0;const cono=seg.map(([c,n])=>{const a=acc/tot*100;acc+=n;return `${c} ${a}% ${acc/tot*100}%`}).join(",");
  const masViejo=B.cola.length?Math.max(...B.cola.map(x=>x.dias||0)):null;
  return `<div class="px-top"><div><span class="px-eyebrow">Socio de negocio · Gestión</span><h2>Tu bandeja de solicitudes</h2><p>Revisa, devuelve, deriva o escala cada caso</p></div>${btnG()}${chipsPeriodo([...new Set(F0.map(f=>f.periodo).filter(Boolean))].sort().reverse())}</div>
   <div class="px-kpis">
     ${kpiPx("primario",B.porRevisar,"Por revisar",masViejo==null?"Nada pendiente":`La más antigua lleva ${masViejo} ${masViejo===1?"día":"días"}`,"estado:Por revisar")}
     ${kpiPx("ambar",B.devueltas,"Devueltas al jefe","Esperan corrección del líder","estado:Devuelto al jefe")}
     ${kpiPx("azul",B.enGerencia,"En Gerencia","Esperan decisión del comité","estado:Enviado a Gerencia")}
     ${kpiPx("verde",B.tasaAprobacion==null?"—":B.tasaAprobacion+"%","Tasa de aprobación","de lo que Gerencia ya resolvió","estado:Aprobado")}
   </div>
   <div class="px-2 px-graf">
     <section class="gx-card"><h3>Para revisar ahora</h3><p class="sub">Ordenadas por urgencia y por cuánto llevan esperando</p>${B.cola.length?B.cola.map(filaCaso).join(""):'<p class="muted">No tienes solicitudes por revisar.</p>'}</section>
     <section class="gx-card"><h3>Cuánto llevan esperando</h3><p class="sub">Solicitudes por revisar según su antigüedad</p>${B.antiguedad.map((x,i)=>`<div class="px-bar"><span class="n">${esc(x.etiqueta)}</span><span class="t"><i class="${["","","am","ro"][i]}" style="width:${Math.round(x.n/maxA*100)}%"></i></span><b>${esc(x.n)}</b></div>`).join("")}
       <p class="px-nota">${B.antiguedad[3].n?`⚠ ${B.antiguedad[3].n} ${B.antiguedad[3].n===1?"lleva":"llevan"} más de 15 días: conviene priorizar.`:"Nada con más de 15 días de espera."}</p></section>
   </div>
   <div class="px-2 px-graf">
     <section class="gx-card"><h3>Dónde está tu trabajo</h3><p class="sub">Todas tus solicitudes según su etapa</p>
       <div class="px-dona"><div class="px-pie" style="background:conic-gradient(${B.total?cono:"#E8ECF6 0 100%"})"><b>${B.total}</b><span>solicitudes</span></div>
       <ul class="px-leg">${seg.map(([c,n,t,e])=>`<li><button type="button" class="px-lk${filtro.estado===e?" on":""}" data-f="estado:${esc(e)}"><i style="background:${c}"></i>${t}<b>${n}</b></button></li>`).join("")}</ul></div></section>
     <section class="gx-card"><h3>Por movimiento</h3><p class="sub">Qué te están pidiendo más</p>${barraPx("movimiento",Bm.porMovimiento)}</section>
   </div>`;
}

// ---------- Cortes y modo presentación (Gerencia) ----------
// Un corte es una copia congelada de los casos que Gerencia lleva a un comité: queda guardada como historial (nadie la edita) y se presenta sin que cambie.
let PRES=null;const SEL=new Set();
const hoyISO=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const fechaHora=iso=>{const d=new Date(iso);return isNaN(d)?"":d.toLocaleString("es-PE",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})};
const URG_ORD={"Inmediato":0,"Dentro de 30 días":1,"Dentro de 60 días":2,"Más adelante":3};
function pendientesHasta(fecha){return aplicarFiltros(D.filas,{...filtro,estado:"Enviado a Gerencia",atencion:""}).filter(f=>String(f.fechaSolicitud||"")<=fecha)}
function dialogoCorte(){
  const dlg=$("dlg"),hay=SEL.size>0;
  const lista=fecha=>hay?D.filas.filter(f=>SEL.has(f.id)):pendientesHasta(fecha);
  dlg.innerHTML=`<div class="dh"><div><span class="mov">Corte para el comité</span><h2>Congelar los casos que vas a presentar</h2><div class="meta"><span>Se guarda una copia fija: lo que cambie después no altera el corte</span></div></div><button type="button" class="x" id="cx1" aria-label="Cerrar">✕</button></div>
   <div class="db"><section class="sec"><h4>Qué casos entran</h4>
     ${hay?`<p class="txt"><b>${SEL.size}</b> caso${SEL.size===1?"":"s"} que seleccionaste en la bandeja.</p><input type="hidden" id="cf" value="${hoyISO()}">`
          :`<label class="kv"><span>Todo lo pendiente de decisión recibido hasta el día</span></label><input type="date" id="cf" value="${hoyISO()}" max="${hoyISO()}" style="font-size:16px"><p class="muted" id="cn"></p>`}
   </section>
   <section class="sec"><h4>Nombre del corte</h4><input id="ct" maxlength="120" style="width:100%;font-size:16px" value="Comité ${esc(hoyISO())}"></section>
   <section class="sec"><h4>Nota (opcional)</h4><textarea id="cnota" rows="2" maxlength="1000" style="width:100%" placeholder="Ej.: casos del área comercial para el comité del jueves"></textarea></section></div>
   <div class="df"><div class="acts"><button type="button" class="btn sec" id="ccancel">Cancelar</button><span class="sp"></span><button type="button" class="btn ok" id="cok">Congelar y presentar</button></div></div>`;
  const cuenta=()=>{const n=lista($("cf").value).length;const e=$("cn");if(e)e.textContent=n?`${n} caso${n===1?"":"s"} entrarán al corte.`:"No hay casos pendientes con esa fecha.";return n};
  if(!hay){$("cf").onchange=cuenta;cuenta()}
  const cerrar=()=>dlg.close();$("cx1").onclick=cerrar;$("ccancel").onclick=cerrar;
  $("cok").onclick=async()=>{const L=lista($("cf").value).slice(0,100),titulo=$("ct").value.trim();
    if(!L.length)return aviso("No hay casos para el corte");if(titulo.length<3)return aviso("Escribe un nombre para el corte");
    if(!await confirmar("Congelar el corte",`Vas a congelar ${L.length} caso${L.length===1?"":"s"} en «${titulo}». Queda guardado en el historial y no se puede modificar.`,{ok:"Congelar y presentar"}))return;
    dlg.querySelectorAll("button").forEach(b=>b.disabled=true);
    google.script.run.withFailureHandler(e=>{dlg.querySelectorAll("button").forEach(b=>b.disabled=false);aviso(e.message||e)})
      .withSuccessHandler(c=>{dlg.close();SEL.clear();PRES=c;pintar();scrollTo(0,0);aviso("✓ Corte guardado en el historial")}).panelCrearCorte(titulo,$("cnota").value.trim(),$("cf").value,L.map(f=>f.id))};
  if(!dlg.open)dlg.showModal();
}
function dialogoHistorial(){
  const dlg=$("dlg");dlg.innerHTML=`<div class="dh"><div><span class="mov">Historial</span><h2>Cortes anteriores</h2><div class="meta"><span>Copias congeladas de lo que se llevó a cada comité</span></div></div><button type="button" class="x" id="cx2" aria-label="Cerrar">✕</button></div><div class="db"><p class="muted">Cargando…</p></div><div class="df"><div class="acts"><button type="button" class="btn sec" id="ccl">Cerrar</button></div></div>`;
  $("cx2").onclick=$("ccl").onclick=()=>dlg.close();if(!dlg.open)dlg.showModal();
  google.script.run.withFailureHandler(e=>{dlg.querySelector(".db").innerHTML=`<p class="err">${esc(e.message||e)}</p>`}).withSuccessHandler(L=>{
    dlg.querySelector(".db").innerHTML=L.length?`<section class="sec">${L.map(c=>`<div class="px-row"><i class="px-av">${esc(String((c.casos||[]).length))}</i><span class="px-mn"><b>${esc(c.titulo)}</b><em>${esc(fechaHora(c.creadoEl))} · ${esc(c.creadoPor)} · hasta ${esc(c.fechaCorte)}</em></span><button type="button" class="gx-ver" data-abrir="${esc(c.id)}">Presentar</button></div>`).join("")}</section>`:'<p class="muted">Todavía no hay cortes. Selecciona casos o pulsa «Hacer corte».</p>';
    dlg.querySelectorAll("[data-abrir]").forEach(b=>b.onclick=()=>{PRES=L.find(c=>c.id===b.dataset.abrir);dlg.close();pintar();scrollTo(0,0)})}).panelCortes();
}
function pintarPresentacion(){
  const c=PRES,casos=(c.casos||[]).slice().sort((a,b)=>(URG_ORD[a.urgencia]??4)-(URG_ORD[b.urgencia]??4)||(Number(b.puntaje)||0)-(Number(a.puntaje)||0));
  const vivo=Object.fromEntries(D.filas.map(f=>[f.id,f.estado])),resueltos=casos.filter(k=>["Aprobado","Rechazado"].includes(vivo[k.id])).length;
  const R=c.resumen||{},mov=(R.porMovimiento||[]).slice().sort((a,b)=>b.n-a.n);
  $("app").innerHTML=`
   <div class="px-top px-noprint"><div><span class="px-eyebrow">Modo presentación · corte congelado</span><h2>${esc(c.titulo)}</h2><p>Corte hasta el ${esc(c.fechaCorte)} · guardado el ${esc(fechaHora(c.creadoEl))} por ${esc(c.creadoPor)}${c.nota?" · "+esc(c.nota):""}</p></div>
     <div class="px-acc"><button type="button" class="px-tog sec" id="btnImprimir">Imprimir / PDF</button><button type="button" class="px-tog" id="btnSalirPres">Salir de la presentación</button></div></div>
   <div class="px-kpis"><div class="px-kpi primario"><span>Casos del corte</span><b>${esc(casos.length)}</b><em>${mov.slice(0,3).map(m=>esc(m.m)+" "+esc(m.n)).join(" · ")}</em></div>
     <div class="px-kpi rojo"><span>Urgentes</span><b>${esc(R.urgentes||0)}</b><em>inmediatos o dentro de 30 días</em></div>
     <div class="px-kpi neutro"><span>Preparación promedio</span><b>${esc(R.preparacion||"—")}</b><em>sobre 100 puntos</em></div>
     <div class="px-kpi verde"><span>Ya decididos</span><b>${esc(resueltos)}</b><em>de ${esc(casos.length)} desde el corte</em></div></div>
   ${casos.map((k,i)=>`<section class="gx-card pr-caso"><div class="px-row" style="border:0;cursor:default"><i class="px-av g">${esc(i+1)}</i><span class="px-mn"><b style="font-size:19px">${esc(k.colaborador||"—")}</b><em style="font-size:14px">${esc(k.movimiento)} · ${esc(k.departamento)}</em></span>${k.puntaje?`<span class="pr-pts" title="Preparación del caso (0 a 100)"><span class="px-sc ${nivelP(+k.puntaje)}">${esc(k.puntaje)}</span><em>preparación</em></span>`:""}<button type="button" class="gx-ver px-noprint" data-ver="${esc(k.id)}">Revisar caso</button></div>
       ${lineaJefe(k.cliente,k.cargoCliente,k.correoCliente||(D.filas.find(f=>f.id===k.id)||{}).enviadoPor)}<div class="px-sus"><p class="tx-p ejec">${marcar(k.sustento||k.texto.split("\n").slice(0,2).join(" "))}</p></div><button type="button" class="px-det px-noprint" data-tog="1">Ver detallado ▾</button><div class="pr-full" hidden><div class="px-sus">${resaltar(k.texto)}</div></div></section>`).join("")}`;
}

$("tabs").onclick=e=>e.target.dataset.v&&cargar(e.target.dataset.v);
$("app").onclick=e=>{const t=e.target;
  if(t.id==="xls")return descargar();
  if(t.id==="trz")return descargar(true);
  if(t.dataset.trz)return descargarCaso(t.dataset.trz);
  const repintar=()=>{const y=scrollY;pintar();scrollTo(0,y)};
  if(t.dataset&&t.dataset.tog){const b=t.nextElementSibling;b.hidden=!b.hidden;t.textContent=b.hidden?"Ver detallado ▾":"Ocultar detallado ▴";return}
  if(t.id==="btnCorte")return dialogoCorte();
  if(t.id==="btnHist")return dialogoHistorial();
  if(t.id==="btnSalirPres"){PRES=null;return pintar()}
  if(t.id==="btnImprimir")return print();
  if(t.id==="limpiarSel"){SEL.clear();return repintar()}
  if(t.id==="selTodo"){const L=aplicarFiltros(D.filas,filtro).slice(0,100),todos=L.every(f=>SEL.has(f.id));L.forEach(f=>todos?SEL.delete(f.id):SEL.add(f.id));return repintar()}
  if(t.dataset&&t.dataset.sel){t.checked?SEL.add(t.dataset.sel):SEL.delete(t.dataset.sel);return repintar()}
  if(t.closest&&t.closest("td.csel"))return;
  if(t.id==="togG"){const o=$("app").classList.toggle("sin-g");t.textContent=o?"Mostrar gráficas":"Ocultar gráficas";try{sessionStorage.setItem("px-sin-g",o?"1":"0")}catch(e){}return}
  const ver=t.closest("[data-ver]");if(ver)return detalle(ver.dataset.ver);
  const fb=t.closest("[data-f]");   // tarjetas, barras y fichas del tablero filtran la bandeja; pulsar de nuevo quita el filtro
  if(fb){const i=fb.dataset.f.indexOf(":"),k=fb.dataset.f.slice(0,i),v=fb.dataset.f.slice(i+1);
    if(k==="limpiar")Object.assign(filtro,{q:"",estado:"",movimiento:"",departamento:"",bp:"",atencion:"",periodo:"",periodoElegido:true});else{filtro[k]=filtro[k]===v?"":v;if(k==="periodo")filtro.periodoElegido=true;if(k==="estado"&&filtro.estado)filtro.atencion="";if(k==="atencion"&&filtro.atencion)filtro.estado=""}
    pintar();const bj=$("bandeja");if(bj&&k!=="limpiar"&&k!=="verMas")bj.scrollIntoView({behavior:"smooth",block:"start"});return}
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
  const f1 = tabla(1, 7, "Por estado", e); tabla(4, 7, "Por Socio de negocio", b);
  const f2 = Math.max(f1, 7 + b.length + 2); tabla(1, f2, "Por tipo de movimiento", mv); tabla(4, f2, "Por departamento", dp);

  // ---- Solicitudes (una fila por solicitud)
  const COLS = [
    ["ID", "id", 22], ["Fecha de solicitud", "fechaSolicitud", 14], ["Estado", "estado", 20], ["Puntaje (0-100)", "puntaje", 11], ["Tipo de movimiento", "movimiento", 24],
    ["Colaborador", "colaborador", 30], ["Matrícula", "codigo", 13], ["Puesto actual", "puestoActual", 30], ["Departamento", "departamento", 34], ["Área", "area", 28], ["Sección", "seccion", 28],
    ["Líder solicitante", "cliente", 26], ["Cargo del líder", "cargoCliente", 28], ["Correo del líder", "enviadoPor", 28], ["Socio de negocio asignado", "bp", 20],
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

  // ---- Trazabilidad: qué le pasó a cada caso (envío del jefe y cada gestión posterior, en orden)
  const wt = wb.addWorksheet("Trazabilidad", { views: [{ state: "frozen", ySplit: 1 }], properties: { tabColor: { argb: "FF1E9E5A" } } });
  wt.columns = [{ header: "ID caso", key: "id", width: 24 }, { header: "Colaborador", key: "col", width: 28 }, { header: "Movimiento", key: "mov", width: 22 }, { header: "Fecha y hora", key: "f", width: 20 }, { header: "Evento", key: "ev", width: 22 },
    { header: "De", key: "de", width: 20 }, { header: "A", key: "a", width: 20 }, { header: "Por", key: "por", width: 30 }, { header: "Rol", key: "rol", width: 14 }, { header: "Comentario", key: "c", width: 70 }];
  cabecera(wt.getRow(1));
  const hora = iso => { const d = new Date(iso); return isNaN(d) ? txt(iso) : d.toLocaleString("es-PE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); };
  const porCaso = {}; (meta.eventos || []).forEach(e => { (porCaso[e.solicitudId] ||= []).push(e); });
  ordenadas.forEach(r => {
    const filasCaso = [{ f: r.enviadoEl, ev: "Envío", de: "", a: "Nuevo", por: txt(r.enviadoPor), rol: "jefe", c: "" }, ...(porCaso[r.id] || []).map(e => ({ f: e.fecha, ev: e.tipo, de: e.de, a: e.a, por: e.por, rol: e.rol === "bp" ? "socio de negocio" : e.rol, c: e.comentario }))];
    filasCaso.forEach(x => { const f = wt.addRow({ id: r.id, col: txt(r.colaborador), mov: txt(r.movimiento), f: hora(x.f), ev: txt(x.ev), de: txt(x.de), a: txt(x.a), por: txt(x.por), rol: txt(x.rol), c: txt(x.c) });
      f.eachCell(c => { c.alignment = { vertical: "top", wrapText: true }; c.border = borde; }); f.getCell("ev").font = { bold: true, color: { argb: NAVY } }; });
  });
  wt.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 10 } };

  // ---- Cortes (solo Gerencia): qué casos se llevaron a cada comité
  if ((meta.cortes || []).length) {
    const wc = wb.addWorksheet("Cortes", { views: [{ state: "frozen", ySplit: 1 }], properties: { tabColor: { argb: "FFB87400" } } });
    wc.columns = [{ header: "Corte", key: "t", width: 30 }, { header: "Hasta la fecha", key: "h", width: 16 }, { header: "Guardado el", key: "g", width: 20 }, { header: "Por", key: "p", width: 28 }, { header: "ID caso", key: "id", width: 24 }, { header: "Colaborador", key: "c", width: 28 }, { header: "Líder solicitante", key: "l", width: 28 }, { header: "Cargo del líder", key: "lc", width: 28 }, { header: "Correo del líder", key: "lm", width: 32 }, { header: "Movimiento", key: "m", width: 22 }, { header: "Urgencia", key: "u", width: 18 }, { header: "Puntaje", key: "s", width: 10 }];
    cabecera(wc.getRow(1));
    meta.cortes.forEach(k => (k.casos || []).forEach(c => { const f = wc.addRow({ t: txt(k.titulo), h: txt(k.fechaCorte), g: hora(k.creadoEl), p: txt(k.creadoPor), id: txt(c.id), c: txt(c.colaborador), l: txt(c.cliente), lc: txt(c.cargoCliente), lm: txt(c.correoCliente), m: txt(c.movimiento), u: txt(c.urgencia), s: txt(c.puntaje) }); f.eachCell(x => { x.border = borde; }); }));
    wc.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 12 } };
  }
  return wb;
}
// </excel>

/** Trazabilidad de UN caso (envío del jefe y cada paso: derivaciones entre socios de negocio, devoluciones, escalada, decisión). */
async function descargarCaso(id){
  const f=D.filas.find(x=>x.id===id);if(!f)return;
  try{
    if(typeof ExcelJS==="undefined")throw new Error("No se pudo cargar la librería de Excel. Revisa tu conexión y recarga.");
    const eventos=(await API.panelEventos(vista)).filter(e=>e.solicitudId===id);
    const wb=construirExcel(ExcelJS,[f],{eventos,cortes:[],titulo:"Trazabilidad del caso "+id,usuario:D.email,fecha:new Date().toLocaleString("es-PE")});
    wb.worksheets.filter(w=>w.name!=="Trazabilidad").forEach(w=>wb.removeWorksheet(w.id));
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([await wb.xlsx.writeBuffer()],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
    a.download="Trazabilidad_"+id+".xlsx";document.body.appendChild(a);a.click();a.remove();
  }catch(x){alert("No se pudo generar la trazabilidad: "+(x.message||x))}
}
function descargar(soloTraz){
  const id=soloTraz?"trz":"xls",txt=soloTraz?"⬇ Trazabilidad":"⬇ Descargar Excel";
  const btn=(t,off)=>{const b=$(id);if(b){b.textContent=t;b.disabled=off}};
  btn("Preparando…",true);
  google.script.run.withFailureHandler(e=>{btn(txt,false);alert(e.message||e)}).withSuccessHandler(async rows=>{
    try{
      const eventos=await API.panelEventos(vista).catch(()=>[]),cortes=vista==="gerencia"?await API.panelCortes().catch(()=>[]):[];
      if(typeof ExcelJS==="undefined") throw new Error("No se pudo cargar la librería de Excel. Revisa tu conexión y recarga.");
      const wb=construirExcel(ExcelJS,rows,{eventos,cortes,titulo:"Solicitudes de Talento · "+TITULOS[vista],usuario:D.email,fecha:new Date().toLocaleString("es-PE")});
      if(soloTraz)wb.worksheets.filter(w=>w.name!=="Trazabilidad").forEach(w=>wb.removeWorksheet(w.id));   // solo la hoja de trazabilidad
      const buf=await wb.xlsx.writeBuffer();
      const a=document.createElement("a");
      a.href=URL.createObjectURL(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
      a.download=(soloTraz?"Trazabilidad_":"Solicitudes_Talento_")+vista+"_"+new Date().toISOString().slice(0,10)+".xlsx";
      document.body.appendChild(a);a.click();a.remove();
    }catch(x){alert("No se pudo generar el Excel: "+(x.message||x))}
    btn(txt,false);
  }).panelExportar(vista,TOKEN);
}

// ---------- Detalle de una solicitud (ventana con encabezado, secciones y barra de acciones fija) ----------
/** Confirmación con el diseño de la app (reemplaza al cuadro del navegador «localhost dice»). Devuelve una promesa: true si acepta. tipo: ok | warn | bad */
function confirmar(titulo,texto,{ok="Aceptar",tipo="ok"}={}){
  return new Promise(res=>{
    const d=document.createElement("dialog");d.className="cf "+tipo;
    d.innerHTML='<div class="cf-ic"></div><h3></h3><p></p><div class="cf-ac"><button type="button" class="cf-no">Cancelar</button><button type="button" class="cf-si"></button></div>';
    d.querySelector(".cf-ic").textContent=tipo==="bad"?"✕":tipo==="warn"?"!":"✓";
    d.querySelector("h3").textContent=titulo;d.querySelector("p").textContent=texto;d.querySelector(".cf-si").textContent=ok;
    let hecho=false;const fin=v=>{if(hecho)return;hecho=true;d.close();d.remove();res(v)};
    d.querySelector(".cf-no").onclick=()=>fin(false);d.querySelector(".cf-si").onclick=()=>fin(true);
    d.addEventListener("cancel",e=>{e.preventDefault();fin(false)});d.addEventListener("click",e=>{if(e.target===d)fin(false)});
    document.body.appendChild(d);d.showModal();d.querySelector(".cf-si").focus();
  });
}
function aviso(t){let e=$("toast");if(!e){e=document.createElement("div");e.id="toast";document.body.appendChild(e)}e.textContent=t;e.className="show";clearTimeout(aviso.t);aviso.t=setTimeout(()=>{e.className=""},3500)}
const lis=s=>String(s||"").split(" | ").filter(Boolean).map(x=>`<li>${esc(x)}</li>`).join("");
const fila=(k,v)=>v==null||String(v).trim()===""?"":`<div class="kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>`;
// Acciones por rol: [texto, estado nuevo (null = conservar el actual), estilo, exige comentario, aviso de éxito, pide confirmación]
let PB={id:""};   // lo que el HRBP va escribiendo del presupuesto: sobrevive a cambiar entre el detalle, el texto para Gerencia y la derivación
const ACCIONES={
  bp:[["Guardar observación",null,"sec",false,"Observación guardada",false],["Devolver al jefe","Devuelto al jefe","warn",true,"Solicitud devuelta al jefe",false],["Pausar","En pausa","sec",false,"Solicitud en pausa",false],["Derivar a otro socio",null,"sec",false,"",false],["Escalar a Gerencia ➜","Enviado a Gerencia","ok",false,"Solicitud escalada: ya está en la bandeja de Gerencia",true]],
  gerencia:[["Guardar comentario",null,"sec",false,"Comentario guardado",false],["Devolver al socio","En revisión BP","warn",true,"Solicitud devuelta al Socio de negocio",false],["Rechazar","Rechazado","bad",true,"Solicitud rechazada",true],["Aprobar ✓","Aprobado","ok",false,"Solicitud aprobada",true]]
};
/** Texto del motor con lo importante en negrita: títulos de sección, etiquetas, importes, fechas, porcentajes y plazos. */
const CLAVES=/(S\/\s?[\d.,]+|\d+(?:[.,]\d+)?\s?%|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|\b\d+\s+(?:personas?|días|meses|colaboradores?|posiciones?)\b|\b\d{1,3}\/100\b|\b(?:Inmediato|Crítico)\b)/g;
const marcar=t=>esc(t).replace(CLAVES,"<strong>$1</strong>");
function resaltar(texto){
  const marca=t=>esc(t).replace(CLAVES,"<strong>$1</strong>");
  return String(texto||"").split("\n").map((l,i)=>{
    const t=l.trim();if(!t)return"";
    if(/^\d+\.\s+\S/.test(t)&&t===t.toUpperCase())return `<h5 class="tx-h">${esc(t.replace(/^\d+\.\s+/,""))}</h5>`;
    const m=/^•\s+([^:]+):\s*(.*)$/.exec(t);if(m)return `<p class="tx-li"><b>${esc(m[1])}</b> ${marca(m[2])}</p>`;
    return i===0?`<p class="tx-t"><strong>${esc(t)}</strong></p>`:`<p class="tx-p">${marca(t)}</p>`}).join("");
}
function detalle(id){
  const f=D.filas.find(x=>x.id===id),ed=D.editables.includes(f.estado||"Nuevo");
  google.script.run.withFailureHandler(fail).withSuccessHandler(d=>{
    const p=Number(d.puntaje),nivel=p>=85?"alto":p>=60?"medio":"bajo",previos=[["Socio de negocio",f.comentarioBP],["Gerencia",f.comentarioGerencia]].filter(x=>x[1]);
    const tg=d.registro&&d.registro.textoGerencia,auto=!tg&&d.registro&&vista==="gerencia"?redactar(d.registro,{comentarioBP:f.comentarioBP}):null;
    const secTexto=`${tg||auto?`<section class="sec"><h4>Texto para Gerencia <span class="orig">${tg?(d.registro.textoOrigen==="motor+editado"?"· redactado por el motor y editado por el Socio de negocio":"· redactado por el motor"):"· generado al abrir, aún sin revisión del Socio de negocio"}</span></h4><pre class="texto">${esc(tg||auto.texto)}</pre></section>`:""}`;
    const secResumen=`<section class="sec"><h4>Resumen</h4><div class="grid">
        ${fila("Líder solicitante",f.cliente+" · "+f.cargoCliente)}${fila("Departamento",f.departamento)}${fila("Área",f.area)}${fila("Sección",f.seccion)}
        ${fila("Matrícula",f.codigo)}${fila("Puesto actual",f.puestoActual)}${fila("Socio de negocio",f.bp)}${fila("Derivada por",f.derivadoPor)}${fila("Urgencia",f.urgencia)}
        ${fila("Impacto si no se ejecuta",f.impacto)}${fila("Consecuencia",f.consecuencia)}</div></section>`;
    const secResto=`<section class="sec"><h4>Presupuesto</h4><div class="grid">${fila("¿Cuenta con presupuesto?",f.presupuesto)}${fila("Fuente",f.fuentePresupuesto)}${fila("Quién valida",f.validaPresupuesto)}${fila("Monto",f.montoPresupuesto!==""?"S/ "+f.montoPresupuesto:"")}</div></section>
      ${d.puntaje?`<section class="sec"><h4>Evaluación automática</h4>
        <div class="score"><div class="ring ${nivel}">${esc(d.puntaje)}</div><div><b>${esc(d.clasificacion)}</b><p class="muted">${esc(d.recomendacion)}</p></div></div>
        <div class="two">${d.fortalezas?`<div class="good"><h5>Fortalezas</h5><ul>${lis(d.fortalezas)}</ul></div>`:""}${d.alertas?`<div class="warnb"><h5>Alertas</h5><ul>${lis(d.alertas)}</ul></div>`:""}</div></section>`:""}
      <section class="sec"><h4>Detalle del impacto</h4><p class="txt">${esc(d.impacto)}</p></section>
      ${d.sustento?`<section class="sec"><h4>Sustento ejecutivo</h4><p class="txt">${esc(d.sustento)}</p></section>`:""}
      ${d.levantamiento.length?`<section class="sec"><h4>Levantamiento</h4>${d.levantamiento.map(([k,v])=>`<div class="qa"><span>${esc(k)}</span><p>${esc(v)}</p></div>`).join("")}</section>`:""}
      ${d.aprobaciones.length?`<section class="sec"><h4>Aprobaciones previas</h4><div class="two">${d.aprobaciones.map(a=>`<div class="ap"><b>${esc(a.name)}</b><span>${esc(a.role)} · ${esc(a.level)}</span><span>${esc(a.date)} · Evidencia: ${esc(a.evidence)}${a.type?" ("+esc(a.type)+")":""}</span></div>`).join("")}</div><div id="evid" class="evid">Cargando captura…</div></section>`:""}
      ${previos.length?`<section class="sec"><h4>Comentarios anteriores</h4>${previos.map(([q,t])=>`<div class="qa"><span>${esc(q)}</span><p>${esc(t)}</p></div>`).join("")}</section>`:""}`;
    const base=tg||(auto&&auto.texto)||"";
    const resumenG=auto?auto.resumen:"";
    const solic=`<section class="sec px-sol"><h4>Quién lo solicita</h4><div class="px-quien"><i class="px-av g">${esc(iniciales(f.cliente))}</i><div><b>${esc(f.cliente||"—")}</b><span>${esc(f.cargoCliente||"Líder de área")}</span>${mailto(f.enviadoPor)?`<span>${mailto(f.enviadoPor)}</span>`:""}</div><div class="px-area"><span>Área solicitante</span><b>${esc(f.area||f.departamento||"—")}</b><em>${esc(f.departamento||"")}</em></div><div class="px-area"><span>Socio de negocio</span><b>${esc(f.bp||"—")}</b></div></div></section>`;
    const visib=`<section class="sec"><h4>Visibilidad del caso</h4><div class="px-vis">
      <div class="px-v"><span>Preparación</span><div class="px-sc ${nivel} g">${esc(d.puntaje||"—")}</div><em>${esc(d.clasificacion||"")}</em></div>
      <div class="px-v"><span>Urgencia</span><b class="pill ${PILL_U[f.urgencia]||"u4"}">${esc(f.urgencia||"—")}</b></div>
      <div class="px-v"><span>Impacto si no se ejecuta</span><b>${esc(f.impacto||"—")}</b><em>${esc(f.consecuencia||"")}</em></div>
      <div class="px-v"><span>Presupuesto</span><b>${esc(f.presupuesto||"—")}</b><em>${f.montoPresupuesto!==""&&f.montoPresupuesto!=null?"S/ "+esc(f.montoPresupuesto):esc(f.fuentePresupuesto||"")}</em></div>
      ${(d.registro&&d.registro.levantamiento||[]).filter(x=>x.i==="cantidadPosiciones")[0]?`<div class="px-v"><span>Posiciones</span><b>${esc(d.registro.levantamiento.filter(x=>x.i==="cantidadPosiciones")[0].r)}</b></div>`:""}<div class="px-v"><span>Aprobación previa</span><b>${d.aprobaciones.length?d.aprobaciones.length+" registrada"+(d.aprobaciones.length===1?"":"s"):"Sin aprobación"}</b></div></div></section>`;
    // ----- Presupuesto confirmado por el HRBP (el jefe solo ve Sí/No; el monto lo ven el HRBP y Gerencia) y trazabilidad -----
    const pi=d.presupuestoInterno;if(PB.id!==id)PB={id,pc:f.presupuestoConfirmado||"",pm:pi?pi.monto:"",pn:pi&&pi.nota?pi.nota:"",sucio:false};
    const secPres=vista==="bp"&&ed?`<section class="sec" id="presHRBP"><h4>Presupuesto · lo confirmas tú</h4>
        <p class="muted" style="margin:0 0 8px">El jefe solo verá «Sí» o «No». El monto y la nota los ven únicamente tú y Gerencia. Debes elegir Sí o No para poder escalar a Gerencia.</p>
        <div class="grid"><div><label class="lbl" for="pc">¿Hay presupuesto?</label><select id="pc"><option value="">— elige —</option><option${PB.pc==="Sí"?" selected":""}>Sí</option><option${PB.pc==="No"?" selected":""}>No</option></select></div>
        <div><label class="lbl" for="pm">Monto disponible (solo HRBP y Gerencia)</label><input id="pm" maxlength="60" value="${esc(PB.pm)}" placeholder="Ej.: S/ 45,000"></div>
        <div style="grid-column:1/-1"><label class="lbl" for="pn">Nota (opcional)</label><input id="pn" maxlength="300" value="${esc(PB.pn)}" style="width:100%"></div></div>
        <div class="acts"><span class="muted">Se guarda con cualquier acción de abajo, o ahora mismo:</span><button type="button" class="btn sec" id="gpres">Guardar presupuesto</button></div></section>`
      :`<section class="sec"><h4>Presupuesto confirmado por el Socio de negocio</h4><div class="grid">${fila("¿Hay presupuesto?",f.presupuestoConfirmado||"Sin confirmar")}${fila("Monto",pi&&pi.monto)}${fila("Nota",pi&&pi.nota)}${pi?fila("Registrado por",pi.por+" · "+fechaHora(pi.fecha)):""}</div></section>`;
    const ROLES={bp:"Socio de negocio",gerencia:"Gerencia"};
    const secTraza=`<section class="sec"><h4>Trazabilidad</h4><div class="tlin"><div><b>Solicitud enviada</b> · ${esc(f.fechaSolicitud)}<br><small>${esc(f.cliente||"—")}${mailto(f.enviadoPor)?" · "+mailto(f.enviadoPor):""}</small></div>${(d.traza||[]).map(e=>`<div><b>${esc(e.tipo)}</b> · ${esc(eb(e.de||"—"))} → ${esc(eb(e.a))}<br><small>${esc(e.por)} (${esc(ROLES[e.rol]||e.rol)}) · ${esc(fechaHora(e.fecha))}</small>${e.comentario?`<br>${esc(e.comentario)}`:""}</div>`).join("")}</div></section>`;
    const susten=(d.sustento||base)?`<section class="sec px-sus"><h4>Sustento ejecutivo</h4><p class="tx-p ejec">${marcar(d.sustento||base.split("\n").slice(0,2).join(" "))}</p></section>`:"";
    $("dlg").innerHTML=`
     <div class="dh"><div><span class="mov">${esc(f.movimiento)}</span><h2>${esc(f.colaborador)}</h2>
       <div class="meta"><span class="tag ${esc(f.estado)}">${esc(eb(f.estado||"Nuevo"))}</span><span>${esc(f.fechaSolicitud)}</span><span class="id">${esc(f.id)}</span></div></div>
       <button type="button" class="x" id="cerrarX" aria-label="Cerrar">✕</button></div>
     <div class="db">${vista==="gerencia"?`${solic}${visib}${secPres}${susten}<button type="button" class="px-det" id="verDet" aria-expanded="false">Ver detallado ▾</button><div id="det" hidden>${secTexto}${secResumen}${secResto}</div>${secTraza}`:`${secTexto}${secResumen}${secPres}${secResto}${secTraza}`}
     </div>
     <div class="df">${ed?`<label for="nc">Observación o comentario${vista==="bp"?" (lo ve Gerencia y, si la devuelves, el jefe)":""}</label>
       <textarea id="nc" rows="2" placeholder="Escribe aquí tu observación…">${esc(vista==="bp"?f.comentarioBP:f.comentarioGerencia)}</textarea>
       <div class="acts"><button type="button" class="btn sec" id="cerrar">Cerrar</button><span class="sp"></span>${ACCIONES[vista].map((a,i)=>`<button type="button" class="btn ${a[2]}" data-i="${i}">${esc(a[0])}</button>`).join("")}</div>`
       :`<div class="acts"><span class="muted">Esta solicitud ya no está en tu etapa: solo lectura.</span><span class="sp"></span><button type="button" class="btn sec" id="cerrar">Cerrar</button></div>`}</div>`;
    const dlg=$("dlg");dlg.showModal();dlg.scrollTop=0;evidencias(id);
    ["pc","pm","pn"].forEach(k=>{const e=$(k);if(e)e.oninput=e.onchange=()=>{PB[k]=e.value;PB.sucio=true}});
    const vd=$("verDet");if(vd)vd.onclick=()=>{const h=$("det").hidden;$("det").hidden=!h;vd.textContent=h?"Ocultar detallado ▴":"Ver detallado ▾";vd.setAttribute("aria-expanded",String(h))};
    const cerrar=()=>dlg.close();$("cerrarX").onclick=cerrar;$("cerrar").onclick=cerrar;
    dlg.onclick=e=>{if(e.target===dlg)cerrar()};   // clic fuera de la ventana
    // Si el HRBP tocó el presupuesto, viaja con cualquier acción (guardar, devolver, pausar, derivar, escalar): un solo lote con la gestión.
    const conPres=extra=>vista==="bp"&&PB.id===id&&PB.sucio?{...(extra||{}),presupuestoConfirmado:PB.pc,presupuestoMonto:PB.pm,presupuestoNota:PB.pn}:extra;
    const aplicar=(estado,coment,extra,ok)=>{dlg.querySelectorAll("button").forEach(x=>x.disabled=true);
      google.script.run.withFailureHandler(e=>{dlg.querySelectorAll("button").forEach(x=>x.disabled=false);aviso(e.message||e)}).withSuccessHandler(()=>{dlg.close();PB={id:""};cargar(vista);aviso("✓ "+ok)}).panelActualizar(id,vista,estado,coment,conPres(extra))};
    const gp=$("gpres");if(gp)gp.onclick=()=>{if(!PB.pc)return aviso("Elige primero Sí o No");PB.sucio=true;aplicar(D.estados.includes(f.estado)?f.estado:D.estados[0],($("nc")?$("nc").value.trim():f.comentarioBP)||"",null,"Presupuesto guardado")};
    // Escalar: el socio de negocio revisa (y puede editar) el texto que recibirá Gerencia; el motor señala lo que falta o no cuadra.
    const componer=coment=>{
      const base=redactar(d.registro,{comentarioBP:coment});
      dlg.innerHTML=`<div class="dh"><div><span class="mov">Escalar a Gerencia</span><h2>Texto para Gerencia</h2><div class="meta"><span>Armado con las respuestas del jefe: revísalo y edítalo antes de enviar</span></div></div><button type="button" class="x" id="cerrarX2" aria-label="Cerrar">✕</button></div>
       <div class="db">${base.alertas.length?`<section class="sec"><h4>Puntos a validar antes de enviar (${base.alertas.length})</h4><ul class="ptos">${base.alertas.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></section>`:'<section class="sec good">Sin puntos pendientes: los datos mínimos están completos.</section>'}
        <section class="sec"><h4>Texto que recibirá Gerencia</h4><textarea id="tg" class="tg" rows="20" spellcheck="true">${esc(base.texto)}</textarea><p class="muted">Cada dato sale de las respuestas del formulario. Si lo editas, queda registrado como «editado por el Socio de negocio».</p></section></div>
       <div class="df"><div class="acts"><button type="button" class="btn sec" id="volver">← Volver al detalle</button><button type="button" class="btn sec" id="regenerar">Regenerar</button><span class="sp"></span><button type="button" class="btn ok" id="enviarG">Enviar a Gerencia ➜</button></div></div>`;
      $("cerrarX2").onclick=()=>dlg.close();$("volver").onclick=()=>detalle(id);
      $("regenerar").onclick=()=>{$("tg").value=base.texto;aviso("Texto regenerado desde los datos")};
      $("enviarG").onclick=async()=>{const t=$("tg").value.trim();if(t.length<30)return aviso("El texto está vacío");
        if(!await confirmar("Enviar a Gerencia","Se enviará el texto que revisaste. La acción queda registrada a tu nombre.",{ok:"Enviar a Gerencia"}))return;
        aplicar("Enviado a Gerencia",coment,{textoGerencia:t,textoOrigen:t===base.texto.trim()?"motor":"motor+editado"},"Solicitud escalada: ya está en la bandeja de Gerencia")};
    };
    // Derivar: pasa la solicitud a otro Socio de negocio (el actual deja de verla; el otro la recibe marcada como derivada).
    const derivar=async coment=>{
      const n=await nombres(),otros=Object.entries(n).filter(([k,v])=>k!==D.bpId&&!/de prueba$/i.test(v)).sort((a,b)=>a[1].localeCompare(b[1]));
      if(!otros.length)return aviso("No hay otros Socio de negocio disponibles");
      dlg.innerHTML=`<div class="dh"><div><span class="mov">Derivar</span><h2>¿A qué Socio de negocio la derivas?</h2><div class="meta"><span>Dejarás de verla; el otro Socio de negocio la recibe en su bandeja</span></div></div><button type="button" class="x" id="cerrarX3" aria-label="Cerrar">✕</button></div>
       <div class="db"><section class="sec"><h4>Socio de negocio destino</h4><div class="ops">${otros.map(([k,nom])=>`<label class="op"><input type="radio" name="dest" value="${esc(k)}"><span>${esc(nom)}</span></label>`).join("")}</div></section>
        <section class="sec"><h4>Motivo de la derivación</h4><textarea id="motivo" rows="3" style="width:100%" placeholder="Por qué la derivas (lo verá quien la reciba)">${esc(coment)}</textarea></section></div>
       <div class="df"><div class="acts"><button type="button" class="btn sec" id="volver3">← Volver al detalle</button><span class="sp"></span><button type="button" class="btn ok" id="derivarOk">Derivar</button></div></div>`;
      $("cerrarX3").onclick=()=>dlg.close();$("volver3").onclick=()=>detalle(id);
      $("derivarOk").onclick=async()=>{const dest=dlg.querySelector("input[name=dest]:checked"),motivo=$("motivo").value.trim();
        if(!dest)return aviso("Elige a quién derivarla");
        if(motivo.length<5){$("motivo").focus();return aviso("Escribe el motivo de la derivación")}
        const nom=n[dest.value];if(!await confirmar("Derivar la solicitud",`Pasará a ${nom} y dejarás de verla.`,{ok:"Derivar",tipo:"warn"}))return;
        aplicar("En revisión BP",motivo,{derivarA:dest.value},"Solicitud derivada a "+nom)};
    };
    if(ed)dlg.querySelectorAll("[data-i]").forEach(b=>b.onclick=async()=>{
      const [txt,nuevo,,exige,ok,confirma]=ACCIONES[vista][b.dataset.i],coment=$("nc").value.trim();
      const estado=nuevo||(D.estados.includes(f.estado)?f.estado:D.estados[0]);
      if(exige&&!coment){$("nc").focus();$("nc").classList.add("falta");return aviso("Escribe una observación para continuar")}
      if(vista==="bp"&&txt==="Derivar a otro socio")return derivar(coment);
      if(vista==="bp"&&nuevo==="Enviado a Gerencia"){if(!(PB.pc||f.presupuestoConfirmado)){const e=$("pc");if(e){e.focus();e.scrollIntoView({block:"center"})}return aviso("Antes de escalar, indica si hay presupuesto (Sí o No)")}return componer(coment)}
      if(confirma&&!await confirmar(txt.replace(/[➜✓]/g,"").trim(),"Esta acción queda registrada a tu nombre.",{ok:txt.replace(/[➜✓]/g,"").trim(),tipo:ACCIONES[vista][b.dataset.i][2]==="bad"?"bad":ACCIONES[vista][b.dataset.i][2]==="warn"?"warn":"ok"}))return;
      aplicar(estado,coment,null,ok)});
  }).panelDetalle(id,vista,TOKEN);
}
// Cierre por inactividad: el panel muestra datos de personas; en un equipo compartido la sesión no debe quedar abierta.
const INACTIVO_MIN=30;let ultimo=Date.now();
["click","keydown","input","scroll"].forEach(ev=>addEventListener(ev,()=>{ultimo=Date.now()},{passive:true}));
setInterval(async()=>{if(Date.now()-ultimo>INACTIVO_MIN*60000&&await FB.usuario()){await FB.signOut(FB.auth);TOKEN=null;mostrarLogin(new Error("Tu sesión se cerró por inactividad. Ingresa de nuevo."))}},30000);
google.script.run.withFailureHandler(mostrarLogin).withSuccessHandler(q=>cargar(q.vistas[q.vistas.length-1])).panelQuien();

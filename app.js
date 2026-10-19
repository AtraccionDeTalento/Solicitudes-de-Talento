const $ = id => document.getElementById(id);
// Configuración de despliegue. endpoint: URL que recibe el JSON de la solicitud (Power Automate, Apps Script, API propia).
// Si está vacío, la solicitud se guarda en este navegador y se ofrece la descarga del archivo.
const APP_VERSION="2.0.0";
const FBp=new Promise(r=>addEventListener("fb",()=>r(window.FB)));   // firebase.js (módulo) avisa al cargar
const CONFIG = {
  endpoint:"firebase",                  // «firebase» = las solicitudes se guardan en Firestore (firebase.js). Vacío = solo en este navegador.
  camposObligatorios:true,             // false = ningún campo es obligatorio (solo Tipo de movimiento y Departamento, necesarios para el ruteo). true = exige todos como antes.
  demoClics:true,                      // true = 7 clics seguidos en el logo de USIL rellenan TODO el formulario con datos al azar (solo pruebas). PONER false antes de abrirlo a los jefes.
  sinPreguntas:false,                   // true = el formulario se muestra SIN preguntas (solo Tipo de movimiento y Departamento, necesarios para el ruteo): base para el rediseño. false = vuelve a mostrar todas.
  modoPrueba:false,                    // true = mínimos de caracteres reducidos (3) para probar. PONER EN false antes de abrirlo a los jefes.
  panelUrl:"panel.html",                // Panel de revisión de HRBP y Gerencia (misma carpeta del sitio).
  soporte:"",                          // Correo de soporte que se muestra al pie.
    sessionMinutes:60                    // Cierre de sesión por inactividad.
};
let BP_MODE=false, SESSION=null;
const SESSION_KEY="bp_session_v1";
const draftKey=()=>"bp_draft_v2:"+(SESSION?SESSION.email:"anon");
const XLSX_SRC={url:"https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",sri:"sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw"};

const MASTER_KEY="bp_master_subset_v1", MASTER_META_KEY="bp_master_meta_v1", HISTORY_KEY="bp_history_v1";
const MOVS=["Promoción","Encargatura","Reemplazo","Puesto nuevo","Incremento salarial","Movimiento interno","Otro"];
const DEPARTAMENTOS=["DIRECCION GENERAL DE SEDES DESCENTRALIZADAS", "DIRECCION GENERAL DEL CSIR", "ESCUELA DE POSGRADO", "GERENCIA DE ADMINISTRACION Y SEGURIDAD", "GERENCIA DE PROYECTOS - SEDE PERU", "GERENCIA DE TALENTO Y CULTURA", "GERENCIA GENERAL", "GERENCIA LEGAL", "GERENCIA SENIOR DE FINANZAS", "PRESIDENCIA EJECUTIVA", "RECTORADO", "VICEPRESIDENCIA DE ASUNTOS CORPORATIVOS", "VICEPRESIDENCIA DE COMUNICACIONES E INNOVACION DIG", "VICEPRESIDENCIA SENIOR", "VICERRECTORADO ACADEMICO", "VICERRECTORADO DE INVESTIGACION"];   // Maestro 05-10-2026; define el BP que recibe la solicitud
const NOCODE=["Puesto nuevo"];   // sin matrícula individual
const PERSONAS=["Ninguna","1","2","3","4","5","6 a 10","11 a 20","Más de 20"];   // personas a cargo: se elige, no se escribe
const SNP=["Sí","No","Parcialmente"];   // Encargatura: «¿Mantendrá sus funciones actuales?» (banco de Amador)
const SN=["Sí","No"];   // las preguntas de opción se responden Sí o No: no hay «Parcialmente», «Por confirmar», «No se sabe» ni «Por definir»

// Banco de preguntas de Amador, TAL CUAL: cada bloque es una pregunta numerada (su título es el texto de la pregunta).
// Un bloque con varias respuestas agrupa los datos de esa pregunta. sub:true = detalle condicional (sin número) de la pregunta anterior.
// Tupla: [id, etiqueta, tipo, opciones|ayuda, ayuda]. when:[id,valor] = el bloque solo aparece si ese campo tiene ese valor.
const SETS = {
"Promoción":[
 {t:"¿A qué puesto se propone promover al colaborador?",q:[["puestoPropuesto","¿A qué puesto se propone promover al colaborador?","text"]]},
 {t:"¿Desde cuándo asumiría o viene realizando las funciones del nuevo puesto?",q:[["desdeCuando","¿Desde cuándo asumiría o viene realizando las funciones del nuevo puesto?","date"]]},
 {t:"¿La posición existe y está aprobada dentro de la estructura?",q:[["posicionExiste","¿La posición existe y está aprobada dentro de la estructura?","select",SN]]},
 {t:"¿Qué cambia respecto a su puesto actual?",q:[["queCambioPromo","¿Qué cambia respecto a su puesto actual?","textarea","Responsabilidades, alcance, nivel de decisión, equipo a cargo, procesos o presupuesto, otro."]]},
 {t:"¿Por qué se propone a este colaborador para asumir la nueva posición?",q:[["porQueColabPromo","¿Por qué se propone a este colaborador para asumir la nueva posición?","textarea","Experiencia, resultados, desempeño, conocimiento o funciones que ya viene realizando."]]},
 {t:"¿Qué se busca lograr con la promoción y qué ocurriría si no se formaliza?",q:[["resultadoImpactoPromo","¿Qué se busca lograr con la promoción y qué ocurriría si no se formaliza?","textarea"]]}],
"Encargatura":[
 {t:"Tipo de encargatura",q:[["tipoEncargatura","Tipo de encargatura","select",["Nueva encargatura","Renovación","Cambio de encargatura"]]]},
 {t:"¿Qué situación genera la necesidad de la encargatura?",q:[["motivoEncargo","¿Qué situación genera la necesidad de la encargatura?","select",["Vacaciones","Licencia","Vacante","Cese","Proyecto temporal","Otro"]]]},
 {t:"¿Qué posición requiere cobertura y a quién reemplaza?",q:[["puestoEncargado","¿Qué posición requiere cobertura y a quién reemplaza?","text","Colaborador o posición."]]},
 {t:"¿Desde cuándo y hasta cuándo se requiere la encargatura?",q:[["fechaInicioEnc","Fecha de inicio","date"],["fechaFinEnc","Fecha estimada de fin","date"]]},
 {t:"¿Qué cambiará temporalmente en las responsabilidades del colaborador?",q:[
  ["mantieneFunciones","¿Mantendrá sus funciones actuales?","select",SNP],
  ["equipoAdicional","¿Tendrá equipo adicional a cargo? ¿Cuántas personas?","select",PERSONAS],
  ["responsabilidadesExtra","¿Qué responsabilidades adicionales asumirá?","textarea"]]},
 {t:"¿Qué se busca asegurar con esta encargatura y qué ocurriría si no se formaliza?",q:[
  ["objetivoEnc","Objetivo","select",["Continuidad operativa","Continuidad del liderazgo","Cobertura de una posición crítica","Cumplimiento de metas","Continuidad de proyecto o proceso","Otro"]],
  ["riesgoNoFormalizar","¿Qué impacto tendría no formalizarla?","textarea"]]},
 {t:"Fecha del primer convenio",when:["tipoEncargatura","Renovación"],q:[["fechaPrimerConvenio","Fecha del primer convenio","date"]]},
 {t:"¿Hasta qué fecha está vigente actualmente?",when:["tipoEncargatura","Renovación"],q:[["fechaTerminoActual","¿Hasta qué fecha está vigente actualmente?","date"]]},
 {t:"¿Por cuánto tiempo adicional se solicita renovar?",when:["tipoEncargatura","Renovación"],q:[["periodoRenovacion","¿Por cuánto tiempo adicional se solicita renovar?","text","Ej.: 3 meses"]]},
 {t:"¿Se mantienen las mismas funciones y condiciones?",when:["tipoEncargatura","Renovación"],q:[["mismasFuncionesRen","¿Se mantienen las mismas funciones y condiciones?","select",SN]]},
 {t:"¿Cambia el monto de la asignación?",when:["tipoEncargatura","Renovación"],q:[["cambiaMontoRen","¿Cambia el monto de la asignación?","select",SN]]},
 {t:"¿Qué resultados justifican continuar con la encargatura?",when:["tipoEncargatura","Renovación"],q:[["resultadosRen","¿Qué resultados justifican continuar con la encargatura?","textarea"]]},
 {t:"¿Qué posición tenía encargada anteriormente?",when:["tipoEncargatura","Cambio de encargatura"],q:[["puestoEncargaturaAnterior","¿Qué posición tenía encargada anteriormente?","text"]]},
 {t:"¿A qué nueva posición cambia la encargatura?",when:["tipoEncargatura","Cambio de encargatura"],q:[["puestoEncargaturaNueva","¿A qué nueva posición cambia la encargatura?","text"]]},
 {t:"¿Por qué se requiere cambiar la encargatura?",when:["tipoEncargatura","Cambio de encargatura"],q:[["motivoCambioEnc","¿Por qué se requiere cambiar la encargatura?","textarea"]]},
 {t:"¿Cambia la asignación económica?",when:["tipoEncargatura","Cambio de encargatura"],q:[["cambiaAsignacionEnc","¿Cambia la asignación económica?","select",SN]]}],
"Reemplazo":[
 {t:"¿Qué colaborador se reemplaza?",q:[["personaOVacanteReemplazo","¿Qué colaborador se reemplaza?","text","Se precarga con el colaborador del paso 1 (maestro). Si la posición no tuvo titular, escribe «Sin titular»."]]},
 {t:"¿Cuál es el motivo del reemplazo?",q:[["motivoVacanteReemplazo","¿Cuál es el motivo del reemplazo?","select",["Renuncia","Cese","Promoción","Traslado","Cambio interno","Otro"]]]},
 {t:"¿Desde cuándo se requiere cubrir la posición?",q:[["fechaInicioReemplazo","¿Desde cuándo se requiere cubrir la posición?","date"]]},
 {t:"¿La posición está aprobada dentro de la estructura vigente?",q:[["posicionAprobadaRep","¿La posición está aprobada dentro de la estructura vigente?","select",SN]]},
 {t:"¿La posición se mantiene igual respecto al puesto que quedó vacante?",q:[["cambioPosicionRep","¿La posición se mantiene igual respecto al puesto que quedó vacante?","select",["Sí, se mantiene igual","No, presenta cambios"]]]},
 {t:"Cambios en la posición",sub:true,when:["cambioPosicionRep","No, presenta cambios"],q:[["queCambiaRep","¿Qué cambia?","select",["Puesto","Responsabilidades","Nivel","Alcance","Condiciones","Otro"],"Revisa o ajusta el descriptivo de puesto precargado en el panel de la derecha («Ampliar vista»). Este caso podría requerir una revisión adicional de estructura o valorización del puesto."]]},
 {t:"¿Qué impacto tendría no cubrir esta posición?",q:[["impactoNoReemplazo","¿Qué impacto tendría no cubrir esta posición?","textarea"]]}],
"Puesto nuevo":[
 {t:"¿Qué puesto se solicita crear?",q:[["puestoNuevo","¿Qué puesto se solicita crear?","text"]]},
 {t:"¿Qué necesidad del negocio origina la creación del puesto?",q:[["necesidadPuesto","¿Qué necesidad del negocio origina la creación del puesto?","textarea","Crecimiento, reestructuración, proyecto nuevo, nueva función o necesidad operativa."]]},
 {t:"¿Por qué la estructura actual no puede cubrir esta necesidad?",q:[["porQueNoAbsorbe","¿Por qué la estructura actual no puede cubrir esta necesidad?","textarea"]]},
 {t:"¿Cuántas posiciones se requieren y desde cuándo?",q:[["cantidadPosiciones","Cantidad","select",["1","2","3","4","5","6","7","8","9","10","Más de 10"]],["fechaRequerida","Fecha tentativa","date"]]},
 {t:"¿Cómo será la posición?",q:[["temporalPermanente","Permanente / Temporal","select",["Permanente","Temporal"]],["reportaA","Reporta a","text"],["tienePersonasPN","Tendrá personas a cargo","select",SN]]},
 {t:"Personas a cargo: cantidad",sub:true,when:["tienePersonasPN","Sí"],q:[["personasCargoPN","Cantidad de personas","select",PERSONAS.slice(1)]]},
 {t:"¿Qué responsabilidades y resultados principales tendrá el puesto?",q:[["responsabilidadesPuesto","¿Qué responsabilidades y resultados principales tendrá el puesto?","textarea","Puedes apoyarte en el descriptivo de puesto precargado o adjunto."]]},
 {t:"¿Qué impacto tendría no crear esta posición?",q:[["impactoNoCrear","¿Qué impacto tendría no crear esta posición?","textarea"]]}],
"Incremento salarial":[
 {t:"¿Cuál es el motivo principal del incremento?",q:[["motivoIncremento","¿Cuál es el motivo principal del incremento?","select",["Retención","Ampliación de responsabilidades","Mérito","Regularización","Obtención de Grado Académico","Otro"]]]},
 {t:"¿Detallar el motivo seleccionado?",q:[["situacionOrigen","¿Detallar el motivo seleccionado?","textarea","Explica qué está ocurriendo actualmente y por qué se solicita el incremento."]]},
 {t:"¿Qué ocurriría si el incremento no se realiza?",q:[["impactoSalida","¿Qué ocurriría si el incremento no se realiza?","textarea"]]},
 {t:"¿Existe riesgo de salida?",when:["motivoIncremento","Retención"],q:[["riesgoSalida","¿Existe riesgo de salida?","select",SN]]},
 {t:"¿El colaborador comunicó intención de renuncia?",when:["motivoIncremento","Retención"],q:[["intencionRenuncia","¿El colaborador comunicó intención de renuncia?","select",SN]]},
 {t:"¿Existe una oferta externa?",when:["motivoIncremento","Retención"],q:[["ofertaExterna","¿Existe una oferta externa?","select",SN]]},
 {t:"Oferta externa: evidencia",sub:true,when:["ofertaExterna","Sí"],q:[["evidenciaOferta","Adjuntar evidencia","select",["Correo","Carta oferta","Mensaje","Otro"]]]}],
"Movimiento interno":[],   // Amador no envió preguntas para este movimiento
"Otro":[
 {t:"¿Qué movimiento o cambio se solicita?",q:[["descripcionOtro","¿Qué movimiento o cambio se solicita?","textarea"]]},
 {t:"¿Por qué se solicita este movimiento?",q:[["sustentoOtro","¿Por qué se solicita este movimiento?","textarea"]]},
 {t:"¿Qué ocurriría si no se realiza?",q:[["impactoOtro","¿Qué ocurriría si no se realiza?","textarea"]]}]
};

// Límites [mínimo, máximo] de caracteres por pregunta. Texto corto: 2-100. Párrafos por nivel: L 60-600, M 40-500, S 30-300.
const TA_TIER={L:[60,600],M:[40,500],S:[30,300]};
const TIER_L=["queCambioPromo","porQueColabPromo","motivoMovimiento","necesidadPuesto","porQueNoAbsorbe","situacionOrigen","queCambioRev","sustentoSubvaloracion","objetivoCaso","sustentoCaso","descripcionOtro","sustentoOtro","motivoHorizontal","motivoReestructura","objetivoReestructura","responsabilidadesPuesto"];
const TIER_S=["cambioPresupuestoRev","cambioDecisionRev","funcionesOtroPuesto","funcionesActualesHorizontal","cambiosReporteRest","resultadosRen","motivoCambioEnc"];
const LIM_OV={personasCargo:[1,60],personasCargoPN:[1,60],personasCargoReemplazo:[1,60],equipoAdicional:[1,60],cambioPersonasRev:[1,60],periodoRenovacion:[2,40],vigenciaCaso:[2,60],
  puestoEncargado:[3,160],personaOVacanteReemplazo:[3,120],areaApoyoHorizontal:[3,120],tipoCasoEspecial:[3,100],
  detalleMovimientosRest:[60,1500],solicitudConcreta:[50,3000]};
function limits(id,type){const [mn,mx]=limitsBase(id,type);return type==="textarea"?[1,mx]:CONFIG.modoPrueba&&mn>3?[3,mx]:[mn,mx]}   // sin mínimo de palabras en los párrafos: solo un tope
function limitsBase(id,type){
  if(LIM_OV[id]) return LIM_OV[id];
  if(type==="textarea") return TA_TIER[TIER_L.includes(id)?"L":TIER_S.includes(id)?"S":"M"];
  return [2,100];
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function monthLabel(v){
  if(!v) return "";
  const [y,m]=v.split("-");
  return `${["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Setiembre","Octubre","Noviembre","Diciembre"][Number(m)-1]} ${y}`;
}
function recordId(){return "CASE-"+Date.now()+"-"+Math.random().toString(36).slice(2,7).toUpperCase()}
function nonempty(v){return String(v??"").trim()!==""}
function store(k,v){try{v===undefined?sessionStorage.removeItem(k):sessionStorage.setItem(k,v);return true}catch(e){return false}}
function load(k,def){try{const s=sessionStorage.getItem(k);return s==null?def:JSON.parse(s)}catch(e){return def}}
let masterEmployees=new Map();
let masterMeta=null;

function normalizeTextKey(v){
  return String(v??"")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .replace(/\s+/g," ");
}

function normalizeEmployeeCode(v){
  let s=String(v??"").trim().replace(/^'+/,"");
  if(!s) return "";
  const digits=s.replace(/\s+/g,"");
  if(/^\d+$/.test(digits)) return digits.padStart(10,"0");
  return s;
}

function firstGivenName(v){
  const s=String(v??"").trim();
  return s ? s.split(/\s+/)[0] : "";
}

function displayPersonName(nombre, apellidoPaterno){
  const n=firstGivenName(nombre);
  const a=String(apellidoPaterno??"").trim();
  return [n,a].filter(Boolean).join(" ");
}

function findHeaderIndex(headers, aliases){
  const normalized=headers.map(normalizeTextKey);
  for(const alias of aliases){
    const idx=normalized.indexOf(normalizeTextKey(alias));
    if(idx>=0) return idx;
  }
  return -1;
}

async function loadMasterFile(){
  const f=$("masterFile").files[0];
  if(!f){avisar("Selecciona primero el archivo Maestro BPs.");return}
  if(!await needXLSX()) return;
  $("masterStatus").value="Leyendo base...";
  $("masterDetail").textContent="Validando estructura del archivo.";
  try{
    const wb=XLSX.read(await f.arrayBuffer(),{type:"array",cellDates:true});
    const ws=wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:false});
    if(!rows.length) throw new Error("El archivo está vacío.");

    let headerRow=-1;
    let indexes=null;
    const scanLimit=Math.min(rows.length,50);

    for(let r=0;r<scanLimit;r++){
      const hdr=(rows[r]||[]).map(v=>String(v??"").trim());
      const candidate={
        codigo:findHeaderIndex(hdr,["Matrícula","Matricula"]),
        apellidoPaterno:findHeaderIndex(hdr,["Apellido Paterno"]),
        nombre:findHeaderIndex(hdr,["Nombre"]),
        puesto:findHeaderIndex(hdr,["Nombre Puesto"]),
        situacion:findHeaderIndex(hdr,["Situación Trabajador","Situacion Trabajador"]),
        departamento:findHeaderIndex(hdr,["Nombre Departamento"]),
        area:findHeaderIndex(hdr,["Nombre Area","Nombre Área"]),
        seccion:findHeaderIndex(hdr,["Nombre Sección","Nombre Seccion"])
      };
      const mandatory=["codigo","apellidoPaterno","nombre","puesto","departamento","area","seccion"];
      if(mandatory.every(k=>candidate[k]>=0)){
        headerRow=r;
        indexes=candidate;
        break;
      }
    }

    if(headerRow<0){
      throw new Error("No se encontraron los encabezados requeridos: Matrícula, Apellido Paterno, Nombre, Nombre Puesto, Nombre Departamento, Nombre Area y Nombre Sección.");
    }

    const nextMap=new Map();
    let duplicates=0;
    for(let r=headerRow+1;r<rows.length;r++){
      const row=rows[r]||[];
      const code=normalizeEmployeeCode(row[indexes.codigo]);
      if(!code) continue;
      const item={
        codigo:code,
        nombre:displayPersonName(row[indexes.nombre],row[indexes.apellidoPaterno]),
        nombreBase:String(row[indexes.nombre]??"").trim(),
        apellidoPaterno:String(row[indexes.apellidoPaterno]??"").trim(),
        puesto:String(row[indexes.puesto]??"").trim(),
        departamento:String(row[indexes.departamento]??"").trim(),
        area:String(row[indexes.area]??"").trim(),
        seccion:String(row[indexes.seccion]??"").trim(),
        situacion:indexes.situacion>=0 ? String(row[indexes.situacion]??"").trim() : "",
        filaExcel:r+1
      };
      if(nextMap.has(code)) duplicates++;
      nextMap.set(code,item);
    }

    masterEmployees=nextMap;
    masterMeta={
      fileName:f.name,
      loadedAt:new Date().toLocaleString("es-PE"),
      headerRow:headerRow+1,
      count:nextMap.size,
      duplicates
    };

    // Guardar solo los campos necesarios para futuras aperturas del sistema.
    const subset=[...nextMap.values()].map(item=>({
      codigo:item.codigo,
      nombre:item.nombre,
      puesto:item.puesto,
      departamento:item.departamento,
      area:item.area,
      seccion:item.seccion,
      situacion:item.situacion,
      filaExcel:item.filaExcel
    }));
    sessionStorage.setItem(MASTER_KEY,JSON.stringify(subset));
    sessionStorage.setItem(MASTER_META_KEY,JSON.stringify(masterMeta));

    $("masterStatus").value=f.name;
    $("masterDetail").textContent=`${nextMap.size.toLocaleString("es-PE")} colaboradores cargados · encabezados detectados en fila ${headerRow+1}${duplicates?` · ${duplicates} código(s) duplicado(s), se usó la última coincidencia`:""} · base guardada para próximas aperturas.`;

    if($("codigo").value && $("codigo").value!=="No aplica") lookupEmployeeByCode();
  }catch(e){
    masterEmployees=new Map();
    masterMeta=null;
    $("masterStatus").value="Error al cargar";
    $("masterDetail").textContent=e.message;
    avisar("No se pudo cargar el Maestro BPs: "+e.message,{titulo:"No se pudo cargar"});
  }
}


function restorePersistedMaster(){
  try{
    const saved=JSON.parse(sessionStorage.getItem(MASTER_KEY)||"[]");
    const meta=JSON.parse(sessionStorage.getItem(MASTER_META_KEY)||"null");
    if(!Array.isArray(saved) || !saved.length) return;

    const map=new Map();
    saved.forEach(item=>{
      const code=normalizeEmployeeCode(item.codigo);
      if(!code) return;
      map.set(code,{
        codigo:code,
        nombre:String(item.nombre??""),
        puesto:String(item.puesto??""),
        departamento:String(item.departamento??""),
        area:String(item.area??""),
        seccion:String(item.seccion??""),
        situacion:String(item.situacion??""),
        filaExcel:Number(item.filaExcel||0)
      });
    });
    masterEmployees=map;
    masterMeta=meta || {
      fileName:"Base maestra guardada",
      loadedAt:"",
      headerRow:null,
      count:map.size,
      duplicates:0
    };
    $("masterStatus").value=masterMeta.fileName||"Base maestra guardada";
    const loadedText=masterMeta.loadedAt ? ` · actualizada ${masterMeta.loadedAt}` : "";
    $("masterDetail").textContent=`${map.size.toLocaleString("es-PE")} colaboradores disponibles${loadedText}. La base fue recuperada automáticamente del navegador.`;
  }catch(e){
    masterEmployees=new Map();
    masterMeta=null;
    $("masterStatus").value="Sin base cargada";
    $("masterDetail").textContent="No se pudo recuperar la base guardada. Carga nuevamente el Maestro BPs.";
  }
}

function clearEmployeeAutofill(){
  ["colaborador","puestoActual","departamento","area","seccion"].forEach(id=>$(id).value="");
}

function setEmployeeFields(item){
  $("colaborador").value=item.nombre||"";
  $("puestoActual").value=item.puesto||"";
  const dep=[...$("departamento").options].find(o=>normalizeTextKey(o.value)===normalizeTextKey(item.departamento));
  $("departamento").value=dep?dep.value:"";
  $("area").value=item.area||"";
  $("seccion").value=item.seccion||"";
}
function cleanSentence(v){
  return String(v??"").trim().replace(/\s+/g," ");
}
function sentence(text){
  const s=cleanSentence(text);
  if(!s) return "";
  return /[.!?]$/.test(s) ? s : s+".";
}
function val(id){
  const el=$(id);
  return el && !el.closest(".hidden") ? cleanSentence(el.value) : "";
}
function proposalFormatted(){
  const tipo=val("tipoPropuestaNegocio");
  const raw=Number(val("propuestaNegocio")||0);
  if(!raw) return "";
  if(tipo==="Monto en S/") return "S/ "+raw.toLocaleString("es-PE",{minimumFractionDigits:2,maximumFractionDigits:2});
  if(tipo==="Porcentaje %") return raw.toLocaleString("es-PE",{maximumFractionDigits:2})+"%";
  return String(raw);
}
function employeeRef(){
  return val("colaborador") || "el colaborador";
}
function joinNatural(items){
  const clean=items.filter(Boolean);
  if(!clean.length) return "";
  if(clean.length===1) return clean[0];
  if(clean.length===2) return clean[0]+" y "+clean[1];
  return clean.slice(0,-1).join(", ")+" y "+clean[clean.length-1];
}
function buildExecutiveSummary(){
  const mov=val("movimiento");
  const person=employeeRef();
  const current=val("puestoActual");
  let paragraphs=[];

  const add = txt => { if(cleanSentence(txt)) paragraphs.push(sentence(txt)); };
  const cantPos=()=>{const n=direct("cantidadPosiciones");return n&&n!=="1"?` (${/^\d+$/.test(n)?n+" posiciones":n+" posiciones"})`:""};
  const usado=new Map();   // la misma respuesta escrita en dos preguntas distintas se cita una sola vez
  const direct = id => {const t=cleanSentence(val(id));if(t.length<25) return t;const k=t.toLowerCase();if(usado.has(k)&&usado.get(k)!==id) return "";usado.set(k,id);return t};
  const lowerLead = txt => {
    const s=cleanSentence(txt);
    if(!s) return "";
    return s.charAt(0).toLowerCase()+s.slice(1);
  };
  const stripEnd = txt => cleanSentence(txt).replace(/[.!?]+$/,"");

  if(mov==="Promoción"){
    const proposed=direct("puestoPropuesto");
    add(`Se solicita la promoción de ${person}${current?` de ${current}`:""}${proposed?` a ${proposed}`:""}`);

    if(direct("queCambioPromo")) add(`Respecto a su puesto actual, cambia: ${stripEnd(direct("queCambioPromo"))}`);
    else add("La promoción se plantea por una evolución relevante del alcance y nivel de responsabilidad del rol");
    if(direct("posicionExiste")==="No") add("La posición propuesta aún no existe o no está aprobada dentro de la estructura");

    if(direct("porQueColabPromo")) add(`Se propone a este colaborador porque: ${stripEnd(direct("porQueColabPromo"))}`);
    if(direct("resultadoImpactoPromo")) add(`Resultado esperado e impacto de no formalizarla: ${stripEnd(direct("resultadoImpactoPromo"))}`);

    add("Se solicita la aprobación de la promoción y la revisión salarial correspondiente");
  }

  else if(mov==="Encargatura"){
    const tipo=direct("tipoEncargatura");
    const role=direct("puestoEncargado");
    const reason=direct("motivoEncargo");
    const cobertura=role?`, para cubrir: ${stripEnd(role)}`:"";

    if(tipo==="Renovación"){
      add(`Se solicita renovar la encargatura de ${person}${cobertura}${direct("periodoRenovacion")?` por ${direct("periodoRenovacion")} adicionales`:""}`);
      if(reason) add(`Situación que origina la encargatura: ${stripEnd(reason)}`);
      if(direct("resultadosRen")){
        let result=stripEnd(direct("resultadosRen"))
          .replace(/^Durante el periodo de encargatura\s*/i,"")
          .replace(/^Durante el periodo anterior\s*/i,"");
        add(`Resultados que justifican continuar: ${result}`);
      }
    } else if(tipo==="Cambio de encargatura"){
      const nueva=direct("puestoEncargaturaNueva");
      add(`Se solicita el cambio de encargatura de ${person}${nueva?` hacia la posición de ${stripEnd(nueva)}`:""}${direct("puestoEncargaturaAnterior")?`, que tenía encargada la posición de ${stripEnd(direct("puestoEncargaturaAnterior"))}`:""}`);
      if(direct("motivoCambioEnc")) add(`El cambio se requiere: ${stripEnd(direct("motivoCambioEnc"))}`);
    } else {
      add(`Se solicita una nueva encargatura para ${person}${cobertura}`);
      if(reason) add(`Situación que origina la encargatura: ${stripEnd(reason)}`);
    }

    if(direct("responsabilidadesExtra")) add(`Durante la encargatura, la persona asumirá responsabilidades adicionales asociadas a: ${stripEnd(direct("responsabilidadesExtra"))}`);
    if(direct("objetivoEnc")) add(`Con la encargatura se busca asegurar: ${lowerLead(direct("objetivoEnc"))}`);
    if(direct("riesgoNoFormalizar")) add(`Si la encargatura no se formaliza: ${stripEnd(direct("riesgoNoFormalizar"))}`);
    add("Se solicita aprobar la encargatura en las condiciones indicadas");
  }

  else if(mov==="Reemplazo"){
    const replaced=direct("personaOVacanteReemplazo");
    const reason=direct("motivoVacanteReemplazo");
    const start=direct("fechaInicioReemplazo");
    const aprob=direct("posicionAprobadaRep");

    add(`Se solicita el reemplazo${replaced?` de ${replaced}`:""}`);
    if(reason) add(`Motivo del reemplazo: ${stripEnd(reason)}`);
    if(start) add(`Se requiere cubrir la posición a partir del ${start}`);

    if(aprob==="No") add("La posición no está aprobada dentro de la estructura vigente");
    if(direct("cambioPosicionRep")==="No, presenta cambios") add(`La posición presenta cambios respecto al puesto que quedó vacante${direct("queCambiaRep")?` (${lowerLead(direct("queCambiaRep"))})`:""}; podría requerir una revisión adicional de estructura o valorización del puesto`);
    if(direct("impactoNoReemplazo")) add(`Si la posición no se cubre: ${stripEnd(direct("impactoNoReemplazo"))}`);

    add("Se solicita la evaluación del reemplazo y, de corresponder, la revisión de las condiciones asociadas al movimiento");
  }

  else if(mov==="Puesto nuevo"){
    const role=direct("puestoNuevo");
    add(`Se solicita la creación del puesto ${role||"propuesto"}${cantPos()}${direct("temporalPermanente")?` (${direct("temporalPermanente").toLowerCase()})`:""}`);

    if(direct("necesidadPuesto")) add(`La creación del puesto se origina: ${stripEnd(direct("necesidadPuesto"))}`);
    if(direct("porQueNoAbsorbe")) add(`La estructura actual no puede cubrir esta necesidad: ${stripEnd(direct("porQueNoAbsorbe"))}`);
    if(direct("responsabilidadesPuesto")) add(`Responsabilidades y resultados principales del puesto: ${stripEnd(direct("responsabilidadesPuesto"))}`);

    if(direct("impactoNoCrear")) add(`Si el puesto no se crea: ${stripEnd(direct("impactoNoCrear"))}`);
    add("Se solicita la aprobación de la creación de la nueva posición");
  }

  else if(mov==="Incremento salarial"){
    const motivo=direct("motivoIncremento");
    const prop=proposalFormatted();
    add(`Se solicita una revisión salarial para ${person}${motivo?` por ${motivo.toLowerCase()}`:""}`);

    if(direct("situacionOrigen")) add(`La solicitud se origina: ${stripEnd(direct("situacionOrigen"))}`);
    if(motivo==="Retención"){
      const riesgo=[];
      if(direct("riesgoSalida")==="Sí") riesgo.push("riesgo de salida");
      if(direct("intencionRenuncia")==="Sí") riesgo.push("intención de renuncia comunicada");
      if(direct("ofertaExterna")==="Sí") riesgo.push(`una oferta externa${direct("evidenciaOferta")?` (evidencia: ${direct("evidenciaOferta").toLowerCase()})`:""}`);
      if(riesgo.length) add(`Se identifica ${joinNatural(riesgo)}`);
      add("Con la revisión salarial se busca mitigar el riesgo de salida y preservar conocimiento relevante para el equipo");
    }

    if(direct("impactoSalida")) add(`Si el incremento no se realiza: ${stripEnd(direct("impactoSalida"))}`);
    if(prop) add(`El cliente plantea como referencia una propuesta de ${prop}, sujeta a la validación técnica de Compensaciones`);
    add("Se solicita a Compensaciones evaluar la consistencia interna y definir la recomendación salarial correspondiente");
  }

  else if(mov==="Movimiento interno"){
    const target=direct("puestoDestino");
    const targetArea=direct("areaDestino");
    add(`Se solicita el movimiento interno de ${person}${target?` hacia ${target}`:""}${targetArea?` en ${targetArea}`:""}`);
    if(direct("motivoMovimiento")) add(`El movimiento se origina: ${stripEnd(direct("motivoMovimiento"))}`);
    if(direct("problemaResuelveML")) add(`Con este cambio se busca resolver: ${stripEnd(direct("problemaResuelveML"))}`);

    const changes=[];
    if(direct("cambiaAlcance")) changes.push("un cambio de alcance");
    if(direct("nuevasFuncionesML")) changes.push("la incorporación de nuevas funciones");
    if(direct("cambiaResponsabilidad")==="Sí") changes.push("un ajuste en el nivel de responsabilidad");
    if(changes.length) add(`La propuesta considera ${joinNatural(changes)}`);

    if(direct("resultadoEsperadoML")) add(`Con el movimiento se busca: ${stripEnd(direct("resultadoEsperadoML"))}`);
    add("Se solicita la aprobación del movimiento interno en las condiciones indicadas");
  }

  else {
    add(`Se solicita la revisión del caso presentado para ${person}`);
    if(direct("descripcionOtro")) add(`La solicitud consiste en: ${stripEnd(direct("descripcionOtro"))}`);
    if(direct("sustentoOtro")) add(`Se solicita porque: ${stripEnd(direct("sustentoOtro"))}`);
    if(direct("impactoOtro")) add(`Si no se realiza: ${stripEnd(direct("impactoOtro"))}`);
    add("Se solicita la evaluación y decisión correspondiente por parte del Comité");
  }

  // Mantener el sustento breve: máximo 6 oraciones ejecutivas.
  const ps=paragraphs.length>8?paragraphs.slice(0,7).concat(paragraphs[paragraphs.length-1]):paragraphs;
  return ps.join(" ").replace(/(?<![\p{L}\d])(\p{L}{2,})(\s+\1)+(?![\p{L}\d])/giu,"$1").replace(/\s+([,.;:])/g,"$1").replace(/\.{2,}/g,".");
}

// ---------- Diálogos propios (reemplazan confirm/alert del navegador): ventana central animada con fondo difuminado ----------
function dialogo({titulo="",texto="",ok="Aceptar",cancelar="",peligro=false}={}){
  let d=$("sysDlg");
  if(!d){d=document.createElement("dialog");d.id="sysDlg";document.body.appendChild(d)}
  d.innerHTML=`<div class="sysIco${peligro?" peligro":""}" aria-hidden="true">${peligro?"!":"i"}</div>${titulo?`<h3>${esc(titulo)}</h3>`:""}<p>${esc(texto).replace(/\n/g,"<br>")}</p><div class="sysBtns">${cancelar?`<button type="button" class="secondary" data-r="0">${esc(cancelar)}</button>`:""}<button type="button" class="${peligro?"danger":""}" data-r="1">${esc(ok)}</button></div>`;
  return new Promise(res=>{
    const fin=v=>{d.classList.add("saliendo");setTimeout(()=>{d.classList.remove("saliendo");if(d.open)d.close();res(v)},170)};
    d.onclick=e=>{const b=e.target.closest("[data-r]");if(b) fin(b.dataset.r==="1");else if(e.target===d&&cancelar) fin(false)};
    d.oncancel=e=>{e.preventDefault();fin(!cancelar)};
    d.showModal();d.querySelector('[data-r="1"]').focus();
  });
}
const confirmar=(texto,o={})=>dialogo({cancelar:"Cancelar",...o,texto});
const avisar=(texto,o={})=>dialogo({...o,texto});

// ---------- Búsqueda de colaborador ----------
function lockNew(reset){
  const mov=$("movimiento").value,isNew=NOCODE.includes(mov);
  ["correoColab","codigo","colaborador","puestoActual"].forEach(id=>$(id).readOnly=isNew);
  $("lookupEmployee").disabled=isNew;
  ["correoColab","codigo","colaborador","puestoActual"].forEach(id=>$(id).closest(".q").classList.toggle("hidden",isNew));   // en Puesto nuevo no hay persona: no se muestran
  if(reset){
    if(isNew){
      $("correoColab").value="";$("codigo").value="No aplica";$("colaborador").value=mov==="Puesto nuevo"?"Vacante nueva":"Varios colaboradores";$("puestoActual").value="No aplica";
      ["departamento","area","seccion"].forEach(id=>$(id).value="");
    }else if($("codigo").value==="No aplica"){
      ["correoColab","codigo","colaborador","puestoActual","departamento","area","seccion"].forEach(id=>$(id).value="");
    }
  }
  $("codigoHelp").textContent=isNew
    ? "Puesto nuevo: no hay colaborador ni matrícula; elige el Departamento y, si quieres, Área y Sección."
    : "Escribe el correo institucional del colaborador y pulsa Buscar: se completan nombre, puesto, departamento, área, sección y matrícula. Si no aparece, complétalos manualmente.";
}

// Consulta al maestro en Firestore (por matrícula, sin listar): devuelve solo la persona buscada.
async function postMaestro(extra){
  try{return {ok:true,item:await (await FBp).maestro(extra)}}
  catch(e){return {ok:false,error:e.code==="permission-denied"?"La búsqueda automática no está disponible.":String(e.message||e)}}
}
function afterAuto(){refresh();store(draftKey(),JSON.stringify({data:gather(),cur,reached}))}
async function lookupRemote(code){
  const help=$("codigoHelp");help.textContent="Buscando en la base…";
  try{
    const r=await postMaestro({codigo:code});
    if(normalizeEmployeeCode($("codigo").value)!==code) return;   // el usuario cambió el código mientras tanto
    if(!r.ok){help.textContent=`${r.error||"No se pudo consultar la base."} Completa los datos manualmente.`;return}
    if(!r.item){help.textContent=`No se encontró ${code} en la base. Completa los datos manualmente.`;return}
    setEmployeeFields(r.item);
    let msg="Datos completados desde la base de personal.";
    if(r.item.situacion&&normalizeTextKey(r.item.situacion)!=="activo") msg+=` Atención: Situación = ${r.item.situacion}.`;
    if(!r.item.area||!r.item.seccion) msg+=" Esta persona no tiene Área o Sección en la base: puedes continuar sin completarlas.";
    help.textContent=msg;afterAuto();
  }catch(e){help.textContent="No se pudo consultar la base ahora. Completa los datos manualmente."}
}
// Búsqueda del colaborador por su correo institucional: completa nombre, puesto, departamento, área, sección y matrícula.
async function lookupEmployeeByEmail(){
  colabManual=false;
  if(NOCODE.includes($("movimiento").value)) return;
  const help=$("codigoHelp"),mail=$("correoColab").value.trim().toLowerCase();
  if(!mail){help.textContent="Escribe el correo institucional del colaborador.";return}
  if(!/^[^@\s]+@(usil\.edu\.pe|usil\.pe|epg\.usil\.pe|sir\.pe|sir\.edu\.pe|institutoemprendedores\.pe|institutoemprendedores\.edu\.pe)$/.test(mail)){help.textContent="Usa el correo institucional del colaborador (el que usa en USIL).";return}
  help.textContent="Buscando en la base…";
  const r=await postMaestro({correo:mail});
  if($("correoColab").value.trim().toLowerCase()!==mail) return;   // el usuario cambió el correo mientras tanto
  if(!r.ok){help.textContent=`${r.error||"No se pudo consultar la base."} Completa los datos manualmente.`;return}
  if(!r.item){help.textContent="No se encontró ese correo en la base. Revisa que esté bien escrito o completa los datos manualmente.";return}
  if(r.item.codigo) $("codigo").value=r.item.codigo;
  setEmployeeFields(r.item);
  let msg="Datos completados desde la base de personal: nombre, puesto, departamento, área, sección y matrícula.";
  if(r.item.situacion&&normalizeTextKey(r.item.situacion)!=="activo") msg+=` Atención: Situación = ${r.item.situacion}.`;
  if(!r.item.area||!r.item.seccion) msg+=" Esta persona no tiene Área o Sección en la base: puedes continuar sin completarlas.";
  help.textContent=msg;afterAuto();
}
async function autoLider(){
  if(!CONFIG.endpoint||!SESSION) return;
  try{
    const r=await postMaestro({lider:true});
    if(r.ok&&r.item){
      let cambio=false;
      if(r.item.nombre){const n=titulo(r.item.nombre);SESSION.name=n;saveSession();$("cliente").value=n;$("userName").textContent=`${n} · Líder`;cambio=true}
      if(r.item.puesto&&!$("cargoCliente").value){$("cargoCliente").value=r.item.puesto;cambio=true}
      if(cambio){lockLeader();afterAuto()}
    }
  }catch(e){/* sin base: el líder se identifica con su correo */}
}

function lookupEmployeeByCode(){
  if(NOCODE.includes($("movimiento").value)) return;
  const help=$("codigoHelp"), code=normalizeEmployeeCode($("codigo").value);
  $("codigo").value=code;
  if(!code){help.textContent="Ingresa el código del colaborador.";return}
  if(CONFIG.endpoint) return void lookupRemote(code);
  if(!masterEmployees.size){help.textContent="No hay base maestra en este equipo: completa los datos del colaborador manualmente.";return}
  const item=masterEmployees.get(code);
  if(!item){help.textContent=`No se encontró ${code} en la base cargada. Completa los datos manualmente.`;return}
  setEmployeeFields(item);
  let msg=`Encontrado en fila ${item.filaExcel} del Maestro BPs.`;
  if(item.situacion && normalizeTextKey(item.situacion)!=="activo") msg+=` Atención: Situación Trabajador = ${item.situacion}.`;
  if(!item.area || !item.seccion) msg+=" Área/Sección vacío en el maestro: complétalo manualmente.";
  help.textContent=msg;
}

// ---------- Construcción de campos ----------
function qHTML([id,label,type,opts,help]){
  const [lmin,max]=limits(id,type);
  const ph=esc(typeof opts==="string"?opts:"");
  let c;
  if(type==="textarea") c=`<textarea id="${id}" maxlength="${max}" placeholder="${ph}"></textarea><div class="cnt">0/${max} · mín. ${lmin}</div>`;
  else if(type==="select") c=`<select id="${id}"${opts.length<=6?' class="chipsel"':""}><option value="">Seleccionar</option>${opts.map(o=>`<option>${esc(o)}</option>`).join("")}</select>`+(opts.length<=6?`<div class="chips" data-for="${id}" role="group">${opts.map(o=>`<button type="button" class="chip" data-v="${esc(o)}" aria-pressed="false">${esc(o)}</button>`).join("")}</div>`:"");
  else c=`<input id="${id}" type="${type}"${["puestoPropuesto","puestoEncargado","puestoEncargaturaNueva"].includes(id)?' list="dpTitulos" autocomplete="off"':""}${type==="number"?' min="0" step="0.01"':' maxlength="'+max+'"'} placeholder="${ph}">`;
  if(type==="date"&&!help) help="Indica la fecha tentativa.";
  if(id==="propuestaNegocio") help="Selecciona primero si la propuesta está en soles o porcentaje.";
  if(INGRESO_IDS.includes(id)){help=AVISO_INGRESO;if(FECHAS_INGRESO.length) c=`<select id="${id}"><option value="">Seleccionar</option>${FECHAS_INGRESO.map(o=>`<option value="${esc(o)}">${esc(fechaLarga(o))}</option>`).join("")}</select>`}
  return `<div class="q"><label for="${id}">${esc(label)}</label>${c}${help?`<div class="help"${id==="propuestaNegocio"?' id="propuestaNegocioHelp"':""}>${esc(help)}</div>`:""}<div class="err"></div></div>`;
}
const G0A=[["fechaSolicitud","Fecha de solicitud","date"],["movimiento","Tipo de movimiento","select",MOVS]];
// Fechas de ingreso: la empresa tiene dos al mes. Cuando RR.HH. confirme el calendario, se escriben aquí («AAAA-MM-DD») y el campo pasa a ser una lista; vacío = fecha libre con aviso.
// Ingresan los lunes: el primero a partir del día 1 y el primero a partir del 15 de cada mes, desde el mes siguiente (la selección no se resuelve en una semana).
const FECHAS_INGRESO=(()=>{const h=new Date(),o=[];for(let m=1;m<=6;m++)for(const dia of [1,15]){const d=new Date(h.getFullYear(),h.getMonth()+m,dia);d.setDate(d.getDate()+(8-d.getDay())%7);o.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`)}return o})();
const INGRESO_IDS=["fechaInicioReemplazo","fechaRequerida"];
const AVISO_INGRESO="Los ingresos son los lunes de inicio de mes y de quincena (dos fechas al mes). La selección toma tiempo: la primera fecha disponible es del mes siguiente. Las posiciones gerenciales pueden tomar un mes como mínimo. En casos excepcionales, contacta al área.";
const fechaLarga=iso=>{const [y,m,d]=iso.split("-");return `lunes ${d}/${m}/${y}`};
const G0B=[["cliente","Nombre del líder solicitante","text","Nombre y apellido"],["cargoCliente","Cargo del líder","text"],["emailCliente","Correo del líder","email","nombre@usil.edu.pe"]];
const G0C=[["colaborador","Nombre y apellido","text","Se completa al buscar el correo"],["puestoActual","Puesto","text"],["departamento","Departamento","select",DEPARTAMENTOS],["area","Área","text"],["seccion","Sección","text"]];
const CODE_HTML=`<div class="q"><label for="correoColab">Buscar por correo institucional</label><div class="inline" style="flex-wrap:nowrap"><input id="correoColab" type="text" inputmode="email" autocapitalize="none" spellcheck="false" autocomplete="off" placeholder="nombre@usil.edu.pe"><button id="lookupEmployee" type="button" class="secondary">Buscar</button></div><div class="help" id="codigoHelp"></div><div class="err"></div></div><div id="colabCard" class="colabcard hidden"></div><div id="colabManualWrap" class="hidden"><button type="button" class="linkbtn" data-colab="manual">¿No lo encuentras? Completar a mano</button></div><div class="q"><label for="codigo">Matrícula del colaborador</label><input id="codigo" inputmode="numeric" placeholder="Se completa sola al buscar por correo"><div class="err"></div></div>`;
const EVID_AP=["Correo","Acta","Documento","Reunión registrada","Otro"];
const LEVELS=["Presidencia","Gerencia General","Líder de Unidad","Líder de Área","Líder inmediato","Otro"], EVID=["Correo","Acta","Reunión","Documento","Otro"];

// Pantalla 1: cada tipo de movimiento es una tarjeta (el select oculto sigue siendo el dato).
function tarjetasMov(){
  const q=$("movimiento").closest(".q");q.classList.add("cardmode");
  q.insertAdjacentHTML("afterbegin",`<div class="movcards" role="group" aria-label="Tipo de movimiento">${MOVS.map(m=>`<button type="button" class="movcard" data-mov="${esc(m)}" aria-pressed="false"><span>${esc(m)}</span></button>`).join("")}</div>`);
  q.addEventListener("click",e=>{const b=e.target.closest(".movcard");if(!b) return;const sel=$("movimiento");if(sel.value===b.dataset.mov) return;sel.value=b.dataset.mov;sel.dispatchEvent(new Event("change",{bubbles:true}))});
}
// Colaborador: un solo buscador. Encontrado → tarjeta de resumen; sin encontrar → «Completar a mano» muestra los campos.
let colabManual=false;
const COLAB_DATOS=["codigo","colaborador","puestoActual","departamento","area","seccion"];
function syncColab(){
  const nuevo=NOCODE.includes($("movimiento").value),v=id=>$(id).value.trim();
  const hay=!nuevo&&!!v("colaborador")&&v("codigo")!=="No aplica";
  const resumen=!nuevo&&!colabManual;
  $("correoColab").closest(".q").classList.toggle("hidden",nuevo);
  COLAB_DATOS.forEach(id=>{
    const ver=nuevo?["departamento","area","seccion"].includes(id):colabManual||(id==="departamento"&&hay&&!v("departamento"));   // si la base no trae el departamento, se pide (define el socio de negocio)
    $(id).closest(".q").classList.toggle("hidden",!ver);
  });
  $("colabCard").classList.toggle("hidden",!(resumen&&hay));
  if(resumen&&hay) $("colabCard").innerHTML=`<div><b>${esc(v("colaborador"))}</b><span>${esc(v("puestoActual")||"Puesto sin registrar")}</span><span>${esc([v("departamento"),v("area"),v("seccion")].filter(Boolean).join(" · "))}</span><span class="muted">Matrícula ${esc(v("codigo")||"—")}</span></div><button type="button" class="linkbtn" data-colab="manual">Corregir datos</button>`;
  $("colabManualWrap").classList.toggle("hidden",nuevo||colabManual||hay);
}
function syncChips(){document.querySelectorAll(".chips").forEach(c=>{const v=$(c.dataset.for).value;c.querySelectorAll(".chip").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.v===v)))})}
const tituloDep=t=>String(t||"").toLowerCase().replace(/(^|\s)(\S)/g,(m,a,c)=>a+c.toUpperCase()).replace(/\s(De|Del|La|Las|Los|Y|E)(?=\s)/g,m=>m.toLowerCase());
function etiquetaAprob(){
  const l=$("tieneAprobacion")&&$("tieneAprobacion").closest(".q").querySelector("label");if(!l) return;
  const dep=$("departamento").value.trim(),t=tituloDep(dep);
  const txt=!dep?"¿La solicitud cuenta con aprobación de la gerencia?":/^gerencia/i.test(dep)?`¿La solicitud cuenta con aprobación de la ${t}?`:`¿La solicitud cuenta con aprobación de la gerencia (${t})?`;
  if(l.firstChild&&l.firstChild.nodeType===3) l.firstChild.textContent=txt; else l.textContent=txt;
}
function syncMov(){
  const m=$("movimiento").value;
  document.querySelectorAll(".movcard").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.mov===m)));
  $("bloqueColab").classList.toggle("hidden",!m);
  syncColab();
}
function renderSpecific(){
  const mov=$("movimiento").value, sets=SETS[mov];
  prevMov=mov;
  $("specificQuestions").innerHTML=sets?sets.map(s=>{const solo=s.q.length===1&&s.q[0][1]===s.t;return `<div class="qgroup ${s.sub?"qsub":"qnum"}${solo?" solo":""}"${s.when?` data-when="${esc(s.when.join("|"))}"`:""}>${s.sub?"":`<h3 class="qtit">${esc(s.t)}</h3>`}<div${s.q.length>1?' class="grid2"':""}>${s.q.map(qHTML).join("")}</div></div>`}).join(""):"";
  document.querySelectorAll("#specificQuestions input,#specificQuestions select,#specificQuestions textarea").forEach(el=>el.dataset.dynamic="1");
  $("specificIntro").textContent=sets
    ? `Solo lo necesario para ${(COSA[mov]||["el movimiento"])[0]}. Respuestas cortas y concretas.`
    : "Elige primero qué necesitas.";
  applyWhen();palabras();
}
// Las palabras de las preguntas comunes se ajustan a la casuística elegida (la promoción, el reemplazo, la creación del puesto…).
const COSA={"Promoción":["la promoción","esta promoción"],"Encargatura":["la encargatura","esta encargatura"],"Reemplazo":["el reemplazo","este reemplazo"],"Puesto nuevo":["la creación del puesto","la creación de este puesto"],"Incremento salarial":["el incremento salarial","este incremento"],"Movimiento interno":["el movimiento interno","este movimiento"],"Otro":["la solicitud","esta solicitud"]};
const COLAB_TIT={"Promoción":"Colaborador a promover","Encargatura":"Colaborador que asumirá la encargatura","Reemplazo":"Colaborador que deja la posición","Puesto nuevo":"Posición solicitada","Incremento salarial":"Colaborador","Movimiento interno":"Colaborador que se mueve","Otro":"Colaborador"};
// Reemplazo: la persona buscada en el paso 1 es quien deja la posición, así que la pregunta 1 («¿A quién reemplaza…?») se precarga con ella (editable).
let autoReemplazo="";
function precargaReemplazo(){
  const f=$("personaOVacanteReemplazo");if(!f||$("movimiento").value!=="Reemplazo") return;
  const n=$("colaborador").value.trim(),p=$("puestoActual").value.trim(),v=n?[n,p].filter(Boolean).join(" — "):"";
  if(!f.value.trim()||f.value===autoReemplazo){f.value=v;autoReemplazo=v}
}
function palabras(){
  const [de,esta]=COSA[$("movimiento").value]||["el movimiento","este movimiento"];
  const L=(id,t)=>{const q=$(id)&&$(id).closest(".q"),l=q&&q.querySelector("label");if(l) l.textContent=t};
  $("hColab").textContent=COLAB_TIT[$("movimiento").value]||"Colaborador";
}
function applyWhen(){
  document.querySelectorAll("[data-when]").forEach(s=>{
    const [id,v]=s.dataset.when.split("|");
    s.classList.toggle("hidden",!($(id)&&$(id).value===v&&!$(id).closest(".hidden")));
  });
  const t=$("tipoPropuestaNegocio"),v=$("propuestaNegocio");
  if(t&&v){
    const m=t.value;
    v.step=m==="Porcentaje %"?"0.1":"0.01";
    v.placeholder=m==="Monto en S/"?"Ej. 6500.00":m==="Porcentaje %"?"Ej. 12.5":"";
    $("propuestaNegocioHelp").textContent=m==="Monto en S/"?"Monto propuesto en soles. Ej.: S/ 6,500.00":m==="Porcentaje %"?"Porcentaje propuesto. Ej.: 12.5 para 12.5%.":"Selecciona primero si la propuesta está en soles o porcentaje.";
  }
}

// ---------- Aprobaciones ----------
function apF(cls,label,type,opts){
  const c=type==="select"
    ? `<select class="${cls}" aria-label="${label}"><option value="">Seleccionar</option>${opts.map(o=>`<option>${o}</option>`).join("")}</select>`
    : `<input class="${cls}" type="${type}" aria-label="${label}"${type==="text"?' maxlength="100"':""}>`;
  return `<div class="q"><label>${label}</label>${c}<div class="err"></div></div>`;
}
function renumberApprovals(){document.querySelectorAll(".approval-card .n").forEach((s,i)=>s.textContent=i+1)}
// Captura de la confirmación: se comprime en el navegador (JPEG, lado mayor 1600 px) hasta caber en MAX_CAPTURA, el mismo tope que firestore.rules.
// Se guarda solo en memoria (card._img): nunca en el borrador del navegador.
const MAX_CAPTURA=400000;
async function comprimirImagen(file){
  if(!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Adjunta una imagen (captura en PNG, JPG o WebP).");
  if(file.size>25*1048576) throw new Error("La imagen pesa más de 25 MB: recórtala e inténtalo de nuevo.");
  const bmp=await createImageBitmap(file).catch(()=>{throw new Error("No se pudo leer la imagen.")});
  try{
    let lado=1600;
    for(let t=0;t<6;t++,lado=Math.round(lado*.75)){
      const k=Math.min(1,lado/Math.max(bmp.width,bmp.height)),c=document.createElement("canvas");
      c.width=Math.max(1,Math.round(bmp.width*k));c.height=Math.max(1,Math.round(bmp.height*k));
      const g=c.getContext("2d");g.fillStyle="#fff";g.fillRect(0,0,c.width,c.height);g.drawImage(bmp,0,0,c.width,c.height);   // fondo blanco: el PNG transparente no queda negro
      for(const q of [.8,.65,.5,.38]){const u=c.toDataURL("image/jpeg",q);if(u.length<=MAX_CAPTURA) return u}
    }
  }finally{bmp.close&&bmp.close()}
  throw new Error("No se pudo comprimir lo suficiente: recorta la captura e inténtalo de nuevo.");
}
function ponerCaptura(card,url,nombre){
  card._img=url;card.dataset.ok="1";
  const info=card.querySelector(".ap-info");info.textContent="";
  const im=document.createElement("img");im.src=url;im.alt="Vista previa de la captura";im.style.cssText="display:block;max-height:90px;max-width:100%;margin-top:6px;border:1px solid #cfd6e6;border-radius:6px";
  info.append(`✔ ${nombre} · comprimida a ${Math.round(url.length*.75/1024)} KB`,im);
  const q=card.querySelector(".ap-file").closest(".q");q.classList.remove("invalid");q.querySelector(".err").textContent="";
}
function addApproval(p={}){
  const card=document.createElement("div");
  card.className="approval-card";
  card.innerHTML=`<div class="inline" style="justify-content:space-between;margin-bottom:10px"><b>Aprobación <span class="n"></span></b><button type="button" class="secondary rm">Eliminar aprobación</button></div><div class="grid">${apF("ap-name","¿Quién aprobó?","text")}${apF("ap-date","Fecha de aprobación","date")}${apF("ap-type","Evidencia de aprobación","select",EVID_AP)}<div class="q"><label>Adjuntar evidencia</label><input class="ap-file" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Captura de la confirmación del jefe aprobador"><div class="help ap-info"></div><div class="err"></div></div><input type="hidden" class="ap-level" value="Gerencia"><input type="hidden" class="ap-role"><input type="hidden" class="ap-evidence" value="Sí"></div><div class="help" style="margin-top:6px">Adjunta una captura (Teams, WhatsApp corporativo, correo…) donde se vea que el jefe aprobador confirma, con su nombre y la fecha. Se comprime en tu equipo antes de enviarse; solo la verán tu Socio de negocio y Gerencia.</div>`;
  $("approvals").appendChild(card);
  [["level","ap-level"],["name","ap-name"],["role","ap-role"],["date","ap-date"],["evidence","ap-evidence"],["type","ap-type"]].forEach(([k,c])=>card.querySelector("."+c).value=p[k]||(k==="level"?"Gerencia":k==="evidence"?"Sí":""));
  card.querySelector(".rm").addEventListener("click",()=>{card.remove();renumberApprovals();refresh()});
  const fi=card.querySelector(".ap-file"),info=card.querySelector(".ap-info");
  if(p.name) info.textContent="Vuelve a adjuntar la captura: por seguridad no se guarda en el borrador.";
  fi.addEventListener("change",async()=>{
    const f=fi.files[0];delete card._img;card.dataset.ok="";info.textContent="";
    if(f){
      info.textContent="Comprimiendo…";
      try{ponerCaptura(card,await comprimirImagen(f),f.name)}
      catch(er){fi.value="";info.textContent="";const q=fi.closest(".q");q.classList.add("invalid");q.querySelector(".err").textContent=er.message}
    }
    refresh();
  });
  renumberApprovals();refresh();
}

// ---------- Datos del caso ----------
const FIXED=["fechaSolicitud","cliente","cargoCliente","emailCliente","departamento","area","seccion","codigo","colaborador","puestoActual","movimiento","tieneAprobacion","solicitudConcreta"];
function gather(){
  const per=($("fechaSolicitud").value||today()).slice(0,7);
  const obj={periodo:per,periodoLabel:monthLabel(per)};
  FIXED.forEach(id=>obj[id]=$(id).value);
  obj.dp=window.DPF?DPF.json():"";
  obj.dynamic={};
  document.querySelectorAll("[data-dynamic='1']").forEach(el=>{if(!el.closest(".hidden")) obj.dynamic[el.id]=el.value});
  obj.approvals=[...document.querySelectorAll(".approval-card")].map(c=>({
    level:c.querySelector(".ap-level").value,name:c.querySelector(".ap-name").value,role:c.querySelector(".ap-role").value,
    date:c.querySelector(".ap-date").value,evidence:c.querySelector(".ap-evidence").value,type:c.querySelector(".ap-type").value
  }));
  return obj;
}
function fill(data){
  FIXED.forEach(id=>$(id).value=data[id]??"");
  if(!$("fechaSolicitud").value) $("fechaSolicitud").value=today();
  renderSpecific();
  window.DPF&&DPF.cargar(data.dp);
  Object.entries(data.dynamic||{}).forEach(([k,v])=>{const el=$(k);if(el) el.value=v??""});
  applyWhen();
  lockNew(false);
  $("approvals").innerHTML="";
  const yes=data.tieneAprobacion==="Sí";
  $("approvalsWrap").classList.toggle("hidden",!yes);
  if(yes) (data.approvals||[]).forEach(addApproval);
  sustentoTouched=nonempty(data.solicitudConcreta);
  counters();refresh();
}
function counters(){document.querySelectorAll("textarea").forEach(t=>{t.style.height="auto";if(t.scrollHeight) t.style.height=Math.min(t.scrollHeight+6,window.innerHeight*0.7)+"px";const c=t.nextElementSibling;if(c&&c.classList.contains("cnt")) c.textContent=`${t.value.length}/${t.maxLength} · mín. ${limits(t.id,"textarea")[0]}`})}

// ---------- Validación ----------
function required(el){
  if(el.id==="area"||el.id==="seccion") return false;
  if(el.id==="correoColab"&&colabManual) return false;   // a mano el correo es opcional   // practicantes, aprendices y otros puestos sin área o sección en la base
  if(el.closest(".hidden")||el.type==="button"||el.disabled) return false;
  if(el.classList.contains("ap-file")) return true;   // la captura siempre: las reglas del servidor también la exigen
  if(!CONFIG.camposObligatorios) return el.id==="movimiento"||el.id==="departamento";
  if(el.classList.contains("ap-role")) return false;   // el cargo ya no se pide
  return true;
}
function check(el){
  if(!required(el)) return "";
  if(el.type==="file") return el.closest(".approval-card").dataset.ok==="1"?"":"Adjunta la captura de la confirmación del jefe aprobador.";
  if(el.type==="checkbox") return el.checked?"":"Debes confirmar para continuar.";
  const v=el.value.trim();
  if(!v) return "Esta pregunta es obligatoria.";
  if(el.tagName==="TEXTAREA"||el.type==="text"){
    const [min,max]=limits(el.id,el.tagName==="TEXTAREA"?"textarea":"text");
    if(v.length<min) return min>5?`Describe con más detalle (mínimo ${min} caracteres).`:`Mínimo ${min} caracteres.`;
    if(v.length>max) return `Máximo ${max} caracteres.`;
    if(v.length>=15&&window.Calidad){const q=Calidad.evaluar(v);if(q.nivel==="invalido") return "Escribe una respuesta con sentido: "+(q.motivos[0]||"revisa el texto");}
  }
  if(el.type==="email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return "Correo no válido.";
  if(el.type==="number" && !(Number(v)>0)) return "Ingresa un valor mayor que 0.";
  return "";
}
function validate(i){
  return [...document.querySelector(`.step[data-step="${i}"]`).querySelectorAll("input,select,textarea")]
    .map(el=>[el,check(el)]).filter(x=>x[1]);
}
function showErrors(errs){
  document.querySelectorAll(".q.invalid").forEach(q=>q.classList.remove("invalid"));
  errs.forEach(([el,msg])=>{
    const q=el.closest(".q");q.classList.add("invalid");
    q.querySelector(".err").textContent=msg;
  });
  const s=$("errSummary");
  s.textContent=`Faltan ${errs.length} pregunta(s) por completar o corregir en este paso.`;
  s.classList.remove("hidden");
  errs[0][0].scrollIntoView({block:"center",behavior:"smooth"});
  errs[0][0].focus({preventScroll:true});
}

// ---------- Evaluación (misma lógica y pesos que la versión de Amador) ----------
function evaluateCase(d){
  let score=0,strengths=[],alerts=[];
  const b={general:0,sustento:0,aprobaciones:0,ejecutivo:0};
  const Q=t=>window.Calidad?Calidad.evaluar(t):{p:1,nivel:"ok",motivos:[]};
  const etiqueta=id=>{const l=document.getElementById(id)&&document.getElementById(id).closest(".q");const x=l&&l.querySelector("label");return x?x.textContent.replace(/\(opcional\)|\*/g,"").trim():id};
  const general=[d.fechaSolicitud,d.cliente,d.departamento,d.movimiento];   // el BP ya no se digita: se asigna por departamento
  const filled=general.filter(nonempty).length;
  b.general=Math.round(filled/general.length*10);score+=b.general;
  if(filled===general.length) strengths.push("Información general completa."); else alerts.push("Faltan datos generales del caso.");
  const dq=Object.entries(d.dynamic||{});
  if(dq.length){
    const sinSentido=[],cortas=[];
    const pts=dq.map(([id,v])=>{
      if(!nonempty(v)) return 0;
      const t=String(v).trim(); if(t.length<20) return 1;
      const q=Q(t); if(q.nivel==="invalido") sinSentido.push(etiqueta(id)); else if(q.nivel==="debil") cortas.push(etiqueta(id));
      return q.p;
    });
    const pct=pts.reduce((a,x)=>a+x,0)/dq.length;
    b.sustento=Math.round(pct*25);score+=b.sustento;
    if(pct>=0.85) strengths.push("Sustento metodológico bien desarrollado.");
    else if(dq.filter(([,v])=>!nonempty(v)).length) alerts.push("Faltan respuestas en el levantamiento específico del movimiento.");
    if(sinSentido.length) alerts.push(`Respuestas que no parecen texto con sentido: ${sinSentido.slice(0,3).join("; ")}${sinSentido.length>3?` y ${sinSentido.length-3} más`:""}.`);
    if(cortas.length) alerts.push(`Respuestas poco claras o poco naturales: ${cortas.slice(0,3).join("; ")}${cortas.length>3?` y ${cortas.length-3} más`:""}.`);
    if(!sinSentido.length&&!cortas.length&&pct<0.85) alerts.push("El levantamiento está incompleto: el puntaje baja con cada respuesta pendiente.");
  }else alerts.push("Selecciona un tipo de movimiento para completar el sustento metodológico.");
  const ap=d.approvals||[];
  if(d.tieneAprobacion==="Sí" && ap.length){
    const complete=ap.filter(a=>a.level&&a.name).length, sinEv=ap.filter(a=>a.evidence==="No").length;
    b.aprobaciones=Math.max(0,Math.min(15,8+complete*3-sinEv*4));score+=b.aprobaciones;
    strengths.push(`Cuenta con ${ap.length} aprobación(es) previa(s) registrada(s).`);
    if(sinEv) alerts.push("Existe aprobación previa sin evidencia documentada.");
    if(complete<ap.length) alerts.push("Hay aprobaciones sin nivel o nombre del aprobador.");
  }else if(d.tieneAprobacion==="No") alerts.push("El caso no cuenta con aprobación previa.");
  else alerts.push("No se ha definido si el caso cuenta con aprobación previa.");
  if(d.movimiento==="Reemplazo"&&(d.dynamic||{}).cambioPosicionRep==="No, presenta cambios") alerts.push("La posición cambia respecto a la vacante: podría requerir una revisión adicional de estructura o valorización del puesto.");
  if(!nonempty(d.solicitudConcreta)) alerts.push("Falta generar o completar el sustento ejecutivo para Comité.");
  else{
    const t=String(d.solicitudConcreta).trim(),q=Q(t),largo=Math.min(1,t.length/250);
    b.ejecutivo=Math.round(15*q.p*largo);score+=b.ejecutivo;
    if(q.nivel==="invalido") alerts.push("El sustento ejecutivo no parece texto con sentido: "+(q.motivos[0]||"reescríbelo")+" ");
    else if(q.nivel==="debil") alerts.push("El sustento ejecutivo se lee poco natural o repetitivo: "+(q.motivos[0]||"revísalo")+" ");
    else if(t.length>=250) strengths.push("Sustento ejecutivo claro y suficientemente desarrollado.");
    if(t.length<150) alerts.push("El sustento ejecutivo es muy breve para un Comité.");
  }
  score=Math.min(100,Math.max(0,Math.round(score*100/65)));   // 65 puntos posibles (general, sustento, aprobaciones y ejecutivo)
  let label,recommendation;
  if(score>=85){label="Caso bien preparado";recommendation="El caso presenta un nivel alto de preparación. Puede pasar a revisión de Compensaciones, sujeto a las validaciones técnicas correspondientes."}
  else if(score>=60){label="Caso viable con observaciones";recommendation="El caso puede avanzar, pero conviene resolver las alertas señaladas antes de elevarlo a Compensaciones."}
  else{label="Requiere gestión previa";recommendation="El caso aún necesita información, validaciones o sustentos adicionales antes de ser enviado a Compensaciones."}
  if(d.tieneAprobacion==="No") recommendation+=" También se recomienda obtener una aprobación previa del nivel correspondiente.";
  if(!nonempty(d.solicitudConcreta)) recommendation+=" Antes de guardar o exportar, genera o completa el sustento ejecutivo para Comité.";
  return {score,label,strengths,alerts,recommendation,breakdown:b};
}

// ---------- Asistente por pasos ----------
const STEPS=["Datos de la solicitud","Preguntas del movimiento","Revisión y envío"];
let cur=0,reached=0,editingCaseId=null,prevMov="",sustentoTouched=false,lastRec=null;

function renderStepper(){
  $("stepper").innerHTML=STEPS.map((s,i)=>`<button type="button" data-go="${i}" class="${i===cur?"on":(i<reached&&i!==cur&&!validate(i).length?"ok":"")}"${i>reached?" disabled":""}${i===cur?' aria-current="step"':""}><b>${i+1}</b><span>${s}</span></button>`).join("");
}
function ocultarPreguntas(){$("fechaSolicitud").closest(".q").classList.add("hidden");   // la fecha es automática
  if(CONFIG.sinPreguntas) document.querySelectorAll("#form .q").forEach(q=>{if(!q.querySelector("#movimiento,#departamento,#confirmo")) q.classList.add("hidden")})}
function refresh(){ocultarPreguntas();syncMov();etiquetaAprob();precargaReemplazo();syncChips();window.DPF&&DPF.render();
  let tot=0,okc=0;
  $("form").querySelectorAll("input,select,textarea").forEach(el=>{
    if(el.id==="confirmo"||el.type==="button") return;
    const req=required(el),q=el.closest(".q");
    if(q) q.classList.toggle("opt",!req&&!el.closest(".hidden"));
    if(q&&q.classList.contains("invalid")&&!check(el)) q.classList.remove("invalid");
    const cuenta=req||(!CONFIG.camposObligatorios&&!el.closest(".hidden")&&!el.disabled&&!el.readOnly&&el.type!=="checkbox");
    if(cuenta){tot++;if(CONFIG.camposObligatorios?!check(el):nonempty(el.value)) okc++}
  });
  const pct=tot?Math.round(okc/tot*100):0;
  $("barfill").style.width=pct+"%";
  $("barTxt").textContent=`${okc} de ${tot} preguntas completas (${pct}%)`;
  renderStepper();
}
function go(n){
  cur=n;reached=Math.max(reached,n);
  document.querySelectorAll(".step").forEach(s=>s.classList.toggle("on",+s.dataset.step===n));
  $("errSummary").classList.add("hidden");
  if(n===STEPS.length-1){if(!sustentoTouched){$("solicitudConcreta").value=buildExecutiveSummary();counters()}renderReview()}
  counters();
  window.Ortografia&&Ortografia.revisarVisibles();   // revisa la ortografía de los textos largos del paso
  $("prevBtn").disabled=n===0;
  $("nextBtn").textContent=n===STEPS.length-1?(editingCaseId?"Guardar cambios":"Enviar solicitud"):"Siguiente →";
  refresh();window.scrollTo({top:0});
}
function next(){
  const errs=validate(cur);
  if(errs.length) return showErrors(errs);
  cur===STEPS.length-1?submit():go(cur+1);
}
function toast(m){const t=$("toast");t.textContent=m;t.classList.remove("hidden");clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.add("hidden"),2800)}

const SOCIOS={};   // departamento → nombre del socio de negocio (se confirma al revisar)
function socioTxt(dep){
  if(!dep) return "Elige el departamento para saber a quién va";
  const n=SOCIOS[dep];
  if(n===undefined){(async()=>{try{SOCIOS[dep]=await (await FBp).socioDe(dep)}catch(e){SOCIOS[dep]=""}if(!$("reviewBox").closest(".hidden"))renderReview()})();return "Confirmando…"}
  if(n===null) return "⚠ Este departamento no tiene socio de negocio asignado: avisa al administrador antes de enviar";
  return n?`${n} · Socio de negocio asignado a ${dep} (asignación automática)`:"Socio de negocio del departamento indicado (asignación automática)";
}
function renderReview(){
  const d=gather(),ev=evaluateCase(d),cls=ev.score>=85?"ok":ev.score>=60?"warn":"bad";
  const li=a=>(a.length?a:["—"]).map(x=>`<li>${esc(x)}</li>`).join("");
  const rows=[["Movimiento",d.movimiento],["Colaborador",`${d.colaborador} (${d.codigo})`],["Puesto",d.puestoActual],["Departamento / Área / Sección",[d.departamento,d.area,d.seccion].filter(Boolean).join(" · ")],["Líder solicitante",`${d.cliente} · ${d.cargoCliente} · ${d.emailCliente}`],["Se envía a",socioTxt(d.departamento)],["Aprobaciones",d.tieneAprobacion==="Sí"?`${d.approvals.length} registrada(s)`:"Sin aprobación previa"],["Sustento ejecutivo",d.solicitudConcreta]];
  let dpm="";try{dpm=(JSON.parse(d.dp||"{}").modo)||""}catch(e){}
  const avisoDp=dpm==="nuevo"||dpm==="ajuste"?`<div class="notice" style="margin-bottom:14px"><b>Descriptivo de puesto ${dpm==="nuevo"?"nuevo":"con ajustes"}:</b> además de esta solicitud, tu propuesta de descriptivo sigue su propio flujo: Jefe → Socio de negocio (HRBP) → Compensaciones → Publicación.</div>`:"";
  $("reviewBox").innerHTML=avisoDp+`<div class="scorebox solo"><div><span class="badge ${cls}">${esc(ev.label)}</span><div class="grid2" style="margin-top:12px"><div class="result-block"><h4>Fortalezas</h4><ul class="list">${li(ev.strengths)}</ul></div><div class="result-block"><h4>Alertas</h4>${ev.alerts.length?`<ul class="list">${li(ev.alerts)}</ul>`:`<p class="muted" style="margin:6px 0 0">Sin alertas.</p>`}</div></div><div class="notice">${esc(ev.recommendation)}</div></div></div><h3>Resumen de la solicitud</h3><dl class="sum">${rows.map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`;
}

// ---------- Envío ----------
function download(name,text,type="application/json"){
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
// Registro plano para Firestore: lo que lee el panel (sin tener que reconstruir el formulario).
function aPlano(rec){
  const d=rec.data,ev=rec.evaluation||{},lista=a=>(a||[]).slice(0,10).join(" | ");
  const levantamiento=(SETS[d.movimiento]||[]).flatMap(b=>b.q.filter(q=>d.dynamic&&d.dynamic[q[0]]).map(q=>({i:q[0],b:b.t,p:q[1],r:String(d.dynamic[q[0]])})));   // objetos (Firestore no admite arreglos anidados): id del campo, bloque del cuestionario, pregunta y respuesta; el motor de redacción los usa
  const p={id:rec.id,enviadoEl:new Date().toISOString(),enviadoPor:SESSION.email.toLowerCase(),origen:"web",periodo:d.periodo,levantamiento,aprobaciones:d.approvals||[],
    puntaje:String(ev.score??""),clasificacion:ev.label||"",fortalezas:lista(ev.strengths),alertas:lista(ev.alerts),recomendacion:ev.recommendation||""};
  FIXED.forEach(k=>{if(k!=="emailCliente")p[k]=String(d[k]??"")});
  p.dp=String(d.dp||"");
  return p;
}
let submitting=false;
async function submit(){
  if(submitting) return;
  for(let i=0;i<STEPS.length;i++){const e=validate(i);if(e.length){go(i);showErrors(e);return}}
  submitting=true;$("nextBtn").disabled=true;$("nextBtn").textContent="Enviando…";
  try{await doSubmit()}finally{submitting=false;$("nextBtn").disabled=false}
}
async function doSubmit(){
  const d=gather(),ev=evaluateCase(d),now=new Date().toISOString();
  const capturas=d.tieneAprobacion==="Sí"?[...document.querySelectorAll(".approval-card")].map(c=>c._img):[];
  const hist=load(HISTORY_KEY,[]),idx=editingCaseId?hist.findIndex(r=>r.id===editingCaseId):-1;
  let rec;
  if(idx>=0){rec={...hist[idx],periodo:d.periodo,periodoLabel:d.periodoLabel,updatedAt:now,data:d,evaluation:ev};hist[idx]=rec}
  else{rec={schemaVersion:2,appVersion:APP_VERSION,id:recordId(),periodo:d.periodo,periodoLabel:d.periodoLabel,savedAt:now,creadoPor:{nombre:SESSION.name,email:SESSION.email,rol:SESSION.role},data:d,evaluation:ev};hist.push(rec)}
  const saved=store(HISTORY_KEY,JSON.stringify(hist));store(draftKey());
  let sent=!CONFIG.endpoint&&saved,err=saved?"":"Este navegador bloquea el almacenamiento local.";
  if(CONFIG.endpoint){
    try{
      const r=await Promise.race([(await FBp).enviar(aPlano(rec),capturas),new Promise((_,no)=>setTimeout(()=>no(new Error("El servidor tardó demasiado en responder.")),20000))]);
      sent=true;err="";rec.sinBP=!r.bp;
      const hh=load(HISTORY_KEY,[]),k=hh.findIndex(x=>x.id===rec.id);if(k>=0){hh[k]=rec;store(HISTORY_KEY,JSON.stringify(hh))}
    }catch(e){sent=false;err=e.code==="permission-denied"?"Sin permiso: revisa que el correo sea @usil.edu.pe y el departamento tenga BP.":(e.message||"No hubo conexión con el servidor.")}
  }
  showDone(rec,sent,err);
}
function showDone(rec,sent,err){
  lastRec=rec;
  ["form","stepper","actionsBar","errSummary"].forEach(id=>$(id).classList.add("hidden"));
  const msg=!sent?`No se pudo enviar al servidor (${esc(err)}). Intenta de nuevo en unos minutos; tu borrador sigue guardado en este equipo.`
    :CONFIG.endpoint?(!rec.sinBP?`Tu solicitud fue enviada a ${SOCIOS[rec.data.departamento]?"tu Socio de negocio, "+SOCIOS[rec.data.departamento]:"tu Socio de negocio"}.`:"Tu solicitud fue registrada; aún no hay un Socio de negocio configurado para tu departamento y se derivó al coordinador.")
    :"Tu solicitud quedó guardada en este equipo. Descarga el Excel y envíalo a tu Socio de negocio.";
  $("done").classList.remove("hidden");
  $("done").innerHTML=`<h2>${sent?"✔ Solicitud registrada":"⚠ Solicitud guardada, falta enviarla"}</h2><p>${msg}</p><dl class="sum"><dt>Código de seguimiento</dt><dd><b>${esc(rec.id)}</b></dd><dt>Movimiento</dt><dd>${esc(rec.data.movimiento)}</dd><dt>Índice de preparación</dt><dd>${rec.evaluation.score}/100 · ${esc(rec.evaluation.label)}</dd></dl><div class="inline" style="margin-top:16px"><button type="button" id="dlXls">Descargar Excel</button><button type="button" class="secondary" id="newReq">Nueva solicitud</button><button type="button" class="secondary" id="mineDone">Mis solicitudes</button></div>`;
  $("dlXls").onclick=()=>exportCase(rec);
  $("newReq").onclick=resetForm;$("mineDone").onclick=showMine;
  if(BP_MODE) renderHistory();
  window.scrollTo({top:0});
}
// ---------- Mis solicitudes (todas las que envió esta persona, también de días anteriores) ----------
const fechaHoraMia=iso=>{const d=new Date(iso);return isNaN(d)?"":d.toLocaleString("es-PE",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})};
const ETAPA=e=>String(e||"").replace("En revisión BP","En revisión");
/** Seguimiento de una solicitud: lo que enviaste y cada paso posterior (solo el rol de quien actuó, nunca su nombre ni su correo). */
async function verSeguimiento(id,lista){
  const r=lista.find(x=>x.id===id),box=$("segBox");if(!r||!box)return;
  box.innerHTML='<p class="muted">Cargando seguimiento…</p>';box.scrollIntoView({behavior:"smooth",block:"nearest"});
  const ROL_TXT={bp:"Tu Socio de negocio",gerencia:"Gerencia"};let pasos=[];
  try{pasos=await (await FBp).seguimiento(id)}catch(e){box.innerHTML=`<p class="muted">No se pudo cargar el seguimiento: ${esc(e.message||e)}</p>`;return}
  const p=r.presupuestoConfirmado;
  box.innerHTML=`<div style="border:1px solid #D9E1F5;border-radius:12px;padding:14px 16px;background:#fff;margin-top:14px"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><h3 style="margin:0">Seguimiento · ${esc(r.colaborador||r.movimiento)}</h3><button type="button" class="linkbtn" id="segCerrar">Cerrar</button></div>
    <p class="muted" style="margin:6px 0 10px">${esc(r.movimiento)} · estado actual: <b>${esc(ETAPA(r.estado||"Nuevo"))}</b>${p?` · Presupuesto confirmado por tu Socio de negocio: <b>${esc(p)}</b>`:""}</p>
    <div style="border-left:3px solid #D9E1F5;padding-left:14px"><div style="margin:10px 0"><b>Enviaste la solicitud</b><br><small class="muted">${esc(fechaHoraMia(r.enviadoEl)||r.fechaSolicitud||"")}</small></div>${pasos.map(e=>`<div style="margin:10px 0"><b>${esc(e.tipo)}</b> · ${esc(ETAPA(e.de||"—"))} → ${esc(ETAPA(e.a))}<br><small class="muted">${esc(ROL_TXT[e.rol]||e.rol)} · ${esc(fechaHoraMia(e.fecha))}</small>${e.comentario?`<br>${esc(e.comentario)}`:""}</div>`).join("")}${pasos.length?"":'<div class="muted" style="margin:10px 0">Todavía sin movimientos: tu Socio de negocio aún no la gestiona.</div>'}</div></div>`;
  $("segCerrar").onclick=()=>{box.innerHTML=""};
}
async function showMine(){
  const m=$("mine"),wasDone=!$("done").classList.contains("hidden");
  ["form","stepper","actionsBar","errSummary","done"].forEach(id=>$(id).classList.add("hidden"));
  m.classList.remove("hidden");m.innerHTML='<h2>Mis solicitudes</h2><p class="muted">Cargando…</p>';
  const volver='<div class="inline" style="margin-top:14px"><button type="button" class="secondary" id="mineBack">← Volver</button></div>';
  try{
    const l=await (await FBp).misSolicitudes();
    m.innerHTML=`<h2>Mis solicitudes</h2><p class="muted">${l.length} enviada(s). Abre el seguimiento de cada una para ver por dónde va y las observaciones que te dejen.</p>`+(l.length?`<div class="tablewrap"><table><thead><tr><th>Fecha</th><th>Código</th><th>Colaborador</th><th>Movimiento</th><th>Estado</th><th>Observación</th><th></th></tr></thead><tbody>${l.map(r=>`<tr><td>${esc(r.fechaSolicitud)}</td><td>${esc(r.id)}</td><td>${esc(r.colaborador)}</td><td>${esc(r.movimiento)}</td><td>${esc(ETAPA(r.estado||"Nuevo"))}</td><td>${esc(r.comentarioBP||r.comentarioGerencia)}</td><td><button type="button" class="linkbtn" data-seg="${esc(r.id)}">Ver seguimiento</button></td></tr>`).join("")}</tbody></table></div><div id="segBox"></div>`:"")+volver;
    m.querySelectorAll("[data-seg]").forEach(b=>b.onclick=()=>verSeguimiento(b.dataset.seg,l));
  }catch(e){m.innerHTML=`<h2>Mis solicitudes</h2><p class="muted">No se pudieron cargar: ${esc(e.message||e)}</p>`+volver}
  $("mineBack").onclick=()=>{m.classList.add("hidden");if(wasDone)$("done").classList.remove("hidden");else{showShell();go(cur)}};
  window.scrollTo({top:0});
}
function baseData(){return {fechaSolicitud:today(),cliente:SESSION?SESSION.name:"",emailCliente:SESSION?SESSION.email:""}}
function showShell(){
  ["form","stepper","actionsBar"].forEach(id=>$(id).classList.remove("hidden"));
  $("done").classList.add("hidden");
}
function resetForm(){
  colabManual=false;
  editingCaseId=null;reached=0;
  fill(baseData());lockLeader();
  $("confirmo").checked=false;store(draftKey());
  showShell();go(0);
}
function lockLeader(){["cliente","emailCliente"].forEach(id=>$(id).readOnly=!BP_MODE);const e=$("registraComo");if(e)e.textContent=SESSION?`Registrando como ${SESSION.name} · ${SESSION.email}`:""}

// ---------- Panel BP: histórico y exportación ----------
function renderHistory(){
  const p=$("histPeriod").value||today().slice(0,7);
  const hist=load(HISTORY_KEY,[]).filter(r=>r.periodo===p);
  $("historyTitle").textContent=`${hist.length} caso(s) · ${monthLabel(p)}`;
  $("historyRows").innerHTML=hist.length?hist.map(r=>`<tr><td>${esc(r.data.fechaSolicitud)}</td><td>${esc(r.data.codigo)}</td><td>${esc(r.data.colaborador)}</td><td>${esc(r.data.cliente)}</td><td>${esc(r.data.movimiento)}</td><td>${esc(r.evaluation?.score)}</td><td><button type="button" class="linkbtn" data-act="open" data-id="${esc(r.id)}">Abrir</button> · <button type="button" class="linkbtn" data-act="xls" data-id="${esc(r.id)}">Excel</button> · <button type="button" class="linkdanger" data-act="del" data-id="${esc(r.id)}">Borrar</button></td></tr>`).join(""):'<tr><td colspan="7">No hay casos en este periodo.</td></tr>';
}
function detailRows(d,ev,bp=""){
  const dyn=d.dynamic||{};
  const rows=[["periodo","Periodo",d.periodoLabel],["fechaSolicitud","Fecha de solicitud",d.fechaSolicitud],["bp","BP asignado",bp],["cliente","Líder solicitante",d.cliente],["cargoCliente","Cargo del líder",d.cargoCliente],["emailCliente","Correo del líder",d.emailCliente],["departamento","Departamento",d.departamento],["area","Área",d.area],["seccion","Sección",d.seccion],["codigo","Código",d.codigo],["colaborador","Nombre",d.colaborador],["puestoActual","Puesto",d.puestoActual],["movimiento","Tipo de movimiento",d.movimiento]];
  (SETS[d.movimiento]||[]).forEach(s=>s.q.forEach(q=>{if(q[0] in dyn) rows.push([q[0],q[1],dyn[q[0]]])}));
  if(d.movimiento==="Incremento salarial"&&dyn.propuestaNegocio){
    const raw=Number(dyn.propuestaNegocio||0),t=dyn.tipoPropuestaNegocio;
    rows.push(["propuestaNegocioFormateada","Propuesta del negocio formateada",t==="Monto en S/"?"S/ "+raw.toLocaleString("es-PE",{minimumFractionDigits:2,maximumFractionDigits:2}):t==="Porcentaje %"?raw.toLocaleString("es-PE",{maximumFractionDigits:2})+"%":String(dyn.propuestaNegocio)]);
  }
  rows.push(["tieneAprobacion","¿Cuenta con la aprobación de la gerencia?",d.tieneAprobacion],["solicitudConcreta","Sustento ejecutivo para Comité",d.solicitudConcreta],["score","Índice de preparación",ev.score],["clasificacion","Clasificación",ev.label],["recomendacion","Recomendación del sistema",ev.recommendation]);
  return rows;
}
function loadXLSX(){
  if(window.XLSX) return Promise.resolve();
  return new Promise((ok,fail)=>{
    const s=document.createElement("script");
    s.src=XLSX_SRC.url;s.integrity=XLSX_SRC.sri;s.crossOrigin="anonymous";
    s.onload=ok;s.onerror=()=>fail(new Error("No se pudo cargar la librería de Excel (¿sin conexión?)."));
    document.head.appendChild(s);
  });
}
async function needXLSX(){try{await loadXLSX();return true}catch(e){avisar(e.message);return false}}
// ---------- Excel individual con diseño (ExcelJS) ----------
const EXCELJS_SRC={url:"https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js",sri:"sha384-Pqp51FUN2/qzfxZxBCtF0stpc9ONI6MYZpVqmo8m20SoaQCzf+arZvACkLkirlPz"};
function loadExcelJS(){
  if(window.ExcelJS) return Promise.resolve();
  return new Promise((ok,fail)=>{
    const s=document.createElement("script");
    s.src=EXCELJS_SRC.url;s.integrity=EXCELJS_SRC.sri;s.crossOrigin="anonymous";
    s.onload=ok;s.onerror=()=>fail(new Error("No se pudo cargar la librería de Excel (¿sin conexión?)."));
    document.head.appendChild(s);
  });
}
async function needExcelJS(){try{await loadExcelJS();return true}catch(e){avisar(e.message);return false}}

function construirExcelCaso(ExcelJS,rec){
  const d=rec.data,ev=rec.evaluation||{},bp=rec.bpAsignado||"";
  const NAVY="FF00195A",AZUL="FF0036DC",GRIS="FFF3F6FC",ETQ="FFE9EEFB",BORDE={style:"thin",color:{argb:"FFD9E1F5"}};
  const borde={top:BORDE,bottom:BORDE,left:BORDE,right:BORDE};
  const fill=argb=>({type:"pattern",pattern:"solid",fgColor:{argb}});
  const txt=v=>v==null?"":String(v);
  const wb=new ExcelJS.Workbook();wb.creator="Solicitudes de Talento · USIL";wb.created=new Date();
  const lineas=(t,ancho)=>txt(t).split("\n").reduce((n,l)=>n+Math.max(1,Math.ceil(l.length/ancho)),0);
  const alto=(t,ancho)=>Math.max(20,lineas(t,ancho)*15+6);

  // ---- Hoja 1: Resumen (ficha de una página)
  const ws=wb.addWorksheet("Resumen",{views:[{showGridLines:false}],properties:{tabColor:{argb:NAVY}},pageSetup:{orientation:"portrait",fitToPage:true,fitToWidth:1,fitToHeight:0}});
  ws.columns=[{width:30},{width:100}];
  ws.mergeCells("A1:B1");const t1=ws.getCell("A1");t1.value="SOLICITUD DE MOVIMIENTO DE TALENTO";t1.font={bold:true,size:18,color:{argb:"FFFFFFFF"}};t1.fill=fill(NAVY);t1.alignment={vertical:"middle",indent:1};ws.getRow(1).height=38;
  ws.mergeCells("A2:B2");const t2=ws.getCell("A2");t2.value=`${txt(d.movimiento)} · ${txt(d.colaborador)} · Código de seguimiento ${txt(rec.id)}`;t2.font={size:11,color:{argb:"FFFFFFFF"}};t2.fill=fill(AZUL);t2.alignment={vertical:"middle",indent:1};ws.getRow(2).height=24;

  const score=Number(ev.score)||0,colorScore=score>=85?"FFD7F3E0":score>=60?"FFFFF4C2":"FFFBD9D9";
  ws.mergeCells("A4:A6");const sc=ws.getCell("A4");sc.value=score;sc.font={bold:true,size:40,color:{argb:NAVY}};sc.fill=fill(colorScore);sc.alignment={vertical:"middle",horizontal:"center"};sc.border=borde;
  const cl=ws.getCell("B4");cl.value=`Índice de preparación (0-100): ${txt(ev.label)}`;cl.font={bold:true,size:14,color:{argb:NAVY}};cl.alignment={vertical:"middle",indent:1};
  ws.mergeCells("B5:B6");const rc=ws.getCell("B5");rc.value=txt(ev.recommendation);rc.alignment={vertical:"top",wrapText:true,indent:1};rc.font={color:{argb:"FF5B6A8F"}};
  ws.getRow(4).height=26;ws.getRow(5).height=22;ws.getRow(6).height=22;

  let f=8;
  const seccion=titulo=>{ws.mergeCells(`A${f}:B${f}`);const c=ws.getCell(`A${f}`);c.value=titulo;c.font={bold:true,color:{argb:"FFFFFFFF"},size:11};c.fill=fill(AZUL);c.alignment={vertical:"middle",indent:1};ws.getRow(f).height=22;f++};
  const fila=(k,v)=>{const a=ws.getCell(`A${f}`),b=ws.getCell(`B${f}`);a.value=k;b.value=txt(v);
    a.font={bold:true,color:{argb:NAVY}};a.fill=fill(ETQ);a.alignment={vertical:"top",wrapText:true,indent:1};b.alignment={vertical:"top",wrapText:true,indent:1};a.border=borde;b.border=borde;
    ws.getRow(f).height=alto(v,105);f++};
  const sp=()=>{f++};
  seccion("DATOS DE LA SOLICITUD");fila("Periodo",d.periodoLabel);fila("Fecha de solicitud",d.fechaSolicitud);fila("Tipo de movimiento",d.movimiento);fila("Socio de negocio asignado",bp||"Pendiente de asignar");sp();
  seccion("LÍDER SOLICITANTE");fila("Nombre",d.cliente);fila("Cargo",d.cargoCliente);fila("Correo",d.emailCliente);sp();
  seccion("COLABORADOR");fila("Nombre",d.colaborador);fila("Código (matrícula)",d.codigo);fila("Puesto actual",d.puestoActual);fila("Departamento",d.departamento);fila("Área",d.area);fila("Sección",d.seccion);sp();
  seccion("EVALUACIÓN AUTOMÁTICA");fila("Fortalezas",(ev.strengths||[]).map(x=>"• "+x).join("\n"));fila("Alertas",(ev.alerts||[]).map(x=>"• "+x).join("\n"));sp();
  seccion("SUSTENTO EJECUTIVO PARA EL COMITÉ");fila("Sustento",d.solicitudConcreta);

  // ---- Hoja 2: Detalle del levantamiento
  const wd=wb.addWorksheet("Detalle levantamiento",{views:[{state:"frozen",ySplit:1}],properties:{tabColor:{argb:AZUL}}});
  wd.columns=[{header:"Campo / pregunta",key:"k",width:62},{header:"Respuesta",key:"v",width:95}];
  const cab=(w,n)=>{const r=w.getRow(1);r.height=30;for(let c=1;c<=n;c++){const x=r.getCell(c);x.font={bold:true,color:{argb:"FFFFFFFF"}};x.fill=fill(NAVY);x.alignment={vertical:"middle",horizontal:"center",wrapText:true};x.border=borde}};
  cab(wd,2);
  detailRows(d,ev,bp).forEach((r,i)=>{const x=wd.addRow({k:txt(r[1]),v:txt(r[2])});x.height=Math.max(20,Math.max(lineas(r[1],68),lineas(r[2],100))*15+6);
    x.eachCell(c=>{c.alignment={vertical:"top",wrapText:true};c.border=borde;if(i%2)c.fill=fill(GRIS)});x.getCell(1).font={bold:true,color:{argb:NAVY}}});
  wd.autoFilter={from:{row:1,column:1},to:{row:1,column:2}};

  // ---- Hoja 3: Aprobaciones previas
  const wa=wb.addWorksheet("Aprobaciones",{views:[{state:"frozen",ySplit:1}],properties:{tabColor:{argb:"FF7A8CC0"}}});
  wa.columns=[{header:"Nivel",key:"a",width:24},{header:"Nombre",key:"b",width:32},{header:"Cargo",key:"c",width:32},{header:"Fecha",key:"d",width:14},{header:"¿Evidencia?",key:"e",width:13},{header:"Tipo de evidencia",key:"f",width:22}];
  cab(wa,6);
  const aps=d.approvals||[];
  if(aps.length) aps.forEach((a,i)=>{const x=wa.addRow({a:txt(a.level),b:txt(a.name),c:txt(a.role),d:txt(a.date),e:txt(a.evidence),f:txt(a.type)});x.eachCell(c=>{c.alignment={vertical:"top",wrapText:true};c.border=borde;if(i%2)c.fill=fill(GRIS)})});
  else{wa.mergeCells("A2:F2");const c=wa.getCell("A2");c.value="Sin aprobaciones previas registradas.";c.font={italic:true,color:{argb:"FF5B6A8F"}};c.alignment={indent:1}}

  // ---- Hoja 4: Datos para Compensaciones (una fila)
  const wc=wb.addWorksheet("Datos para Compensaciones",{views:[{state:"frozen",ySplit:1,xSplit:1}],properties:{tabColor:{argb:"FFF3BE00"}}});
  const COLS=[["Periodo",d.periodoLabel,16],["Fecha de solicitud",d.fechaSolicitud,14],["BP",bp,22],["Líder",d.cliente,26],["Departamento",d.departamento,34],["Área",d.area,28],["Sección",d.seccion,26],["Código",d.codigo,13],["Nombre",d.colaborador,32],["Puesto",d.puestoActual,28],["Tipo de movimiento",d.movimiento,22],["¿Aprobación previa?",d.tieneAprobacion,13],["N.º de aprobaciones",aps.length,13],["Puntaje (0-100)",score,11],["Clasificación",ev.label,26],["Sustento ejecutivo",d.solicitudConcreta,90]];
  wc.columns=COLS.map(c=>({header:c[0],width:c[2]}));cab(wc,COLS.length);
  const r=wc.addRow(COLS.map(c=>typeof c[1]==="number"?c[1]:txt(c[1])));r.height=Math.max(30,lineas(d.solicitudConcreta,95)*15+6);
  r.eachCell(c=>{c.alignment={vertical:"top",wrapText:true};c.border=borde});
  const ps=r.getCell(19);ps.fill=fill(colorScore);ps.font={bold:true};ps.alignment={vertical:"top",horizontal:"center"};
  return wb;
}
async function exportCase(rec){
  if(!await needExcelJS()) return;
  const d=rec.data,wb=construirExcelCaso(ExcelJS,rec);
  const buf=await wb.xlsx.writeBuffer();
  const safe=(d.colaborador||"caso").replace(/[\\/:*?"<>|]+/g,"_").replace(/\s+/g,"_");
  download(`BP_${txt0(d.movimiento).replace(/\s+/g,"_")}_${safe}_${d.fechaSolicitud||today()}.xlsx`,buf,"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}
const txt0=v=>v==null?"":String(v);
async function exportAllPeriod(){
  if(!await needXLSX()) return;
  const p=$("histPeriod").value||today().slice(0,7),hist=load(HISTORY_KEY,[]).filter(r=>r.periodo===p);
  if(!hist.length) return avisar("No hay casos guardados en este periodo.");
  const wb=XLSX.utils.book_new(),A=XLSX.utils.aoa_to_sheet.bind(XLSX.utils);
  XLSX.utils.book_append_sheet(wb,A([["ID caso","Periodo","Fecha solicitud","BP","Cliente","Departamento","Área","Sección","Código","Nombre","Puesto","Tipo movimiento","Tiene aprobación","N° aprobaciones","Score","Clasificación","Recomendación","Sustento ejecutivo"],...hist.map(r=>{const d=r.data,ev=r.evaluation||{};return [r.id,r.periodoLabel,d.fechaSolicitud,r.bpAsignado||"",d.cliente,d.departamento,d.area,d.seccion,d.codigo,d.colaborador,d.puestoActual,d.movimiento,d.tieneAprobacion,(d.approvals||[]).length,ev.score,ev.label,ev.recommendation,d.solicitudConcreta]})]),"Casos del periodo");
  const ap=[["ID caso","Periodo","Código","Nombre","Nivel","Aprobador","Cargo","Fecha","Evidencia","Tipo evidencia"]];
  hist.forEach(r=>(r.data.approvals||[]).forEach(a=>ap.push([r.id,r.periodoLabel,r.data.codigo,r.data.colaborador,a.level,a.name,a.role,a.date,a.evidence,a.type])));
  XLSX.utils.book_append_sheet(wb,A(ap),"Aprobaciones");
  const det=[["ID caso","Periodo","ID campo","Campo","Valor"]];
  hist.forEach(r=>detailRows(r.data,r.evaluation||{},r.bpAsignado||"").forEach(x=>det.push([r.id,r.periodoLabel,...x])));
  XLSX.utils.book_append_sheet(wb,A(det),"Detalle casos");
  XLSX.writeFile(wb,`Casos_BP_${p}.xlsx`);
}
async function resetWholeSystem(){
  if(!await confirmar("Se eliminarán la base maestra guardada, todos los casos y el borrador actual. Esta acción no se puede deshacer.",{titulo:"¿Reiniciar todo el sistema?",ok:"Reiniciar",peligro:true})) return;
  [MASTER_KEY,MASTER_META_KEY,HISTORY_KEY,draftKey()].forEach(k=>store(k));
  masterEmployees=new Map();masterMeta=null;
  $("masterFile").value="";$("masterStatus").value="Sin base cargada";$("masterDetail").textContent="No hay base maestra cargada.";
  resetForm();renderHistory();
}

// ---------- Modo demo (7 clics en el logo, solo con CONFIG.demoClics) ----------
// Rellena los 7 pasos con una persona al azar de la base (solo si Firestore config/app.modoPrueba es true); solo falta pulsar «Enviar solicitud».
const DEMO_PICK={tieneAprobacion:"Sí",personasCargo:"3",personasCargoPN:"2",personasCargoReemplazo:"2",equipoAdicional:"2",tipoPropuestaNegocio:"Porcentaje %"};
const DEMO_TEXT={propuestaNegocio:"8",personasCargo:"3 personas",personasCargoPN:"2 personas",personasCargoReemplazo:"2 personas",equipoAdicional:"2 personas",cambioPersonasRev:"Sí, de 2 a 4 personas",periodoRenovacion:"3 meses",reportaA:"Subgerente de Talento y Cultura",puestoPropuesto:"Analista Senior",puestoEncargado:"Jefe de Área",aQuienReemplaza:"Jefe saliente (vacancia)",puestoReemplazo:"Analista Senior",personaOVacanteReemplazo:"Vacante por renuncia",puestoNuevo:"Analista de Datos de Talento",puestoDestino:"Analista Senior",areaDestino:"Selección y Desarrollo",tipoCasoEspecial:"Convenio de colaboración",vigenciaCaso:"6 meses",areaReestructura:"Área de Talento",areaApoyoHorizontal:"Gerencia de Talento y Cultura",puestoEncargaturaAnterior:"Coordinador de Área","ap-name":"Aprobador de ejemplo","ap-role":"Gerente General"};
const DEMO_FRASES=["El colaborador asumió funciones de mayor alcance y responsabilidad en los últimos meses, con resultados verificables y reconocimiento del equipo.","La necesidad surge por el crecimiento de la operación, que hoy supera la capacidad de la estructura actual y afecta los plazos comprometidos.","Con esta decisión se asegura la continuidad del servicio, se reduce el riesgo de perder talento clave y se ordena la carga de trabajo del área."];
function demoTexto(min,max){let t="",i=0;while(t.length<Math.max(min,60)+10&&i<12) t+=(t?" ":"")+DEMO_FRASES[i++%3];return t.slice(0,Math.max(1,max-1))}
const demoTick=ms=>new Promise(r=>setTimeout(r,ms));
function dset(id,v){const e=$(id);if(!e) return;e.value=v;e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}))}
function demoAuto(step){
  const root=document.querySelector(`.step[data-step="${step}"]`);
  const dias=n=>new Date(Date.now()+n*864e5).toISOString().slice(0,10);
  for(let pass=0;pass<4;pass++) root.querySelectorAll("input,select,textarea").forEach(el=>{
    if(el.closest(".hidden")||el.disabled||el.readOnly||el.type==="button"||el.type==="file"||el.type==="hidden"||el.value) return;
    if(el.type==="checkbox"){el.checked=true;el.dispatchEvent(new Event("change",{bubbles:true}));return}
    const id=el.id||[...el.classList].find(c=>c.startsWith("ap-"))||"";
    if(id==="area"||id==="seccion") return;   // opcionales: si la base no los trae, se dejan vacíos
    let v;
    if(el.tagName==="SELECT"){const o=[...el.options].filter(x=>x.value);v=(o.find(x=>x.value===DEMO_PICK[id])||o[Math.min(1,o.length-1)]||{}).value}
    else if(el.type==="date") v=/fin|hasta|termino/i.test(id)?dias(90):dias(0);
    else if(el.type==="number") v=DEMO_TEXT[id]||"1500";
    else if(el.tagName==="TEXTAREA"){const [mn,mx]=limits(el.id,"textarea");v=demoTexto(mn,mx)}
    else{v=DEMO_TEXT[id];if(v===undefined){const [mn]=limits(el.id,"text");v="Ejemplo demostrativo".padEnd(mn,"x")}}
    if(v!==undefined){el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}))}
  });
  root.querySelectorAll(".approval-card").forEach(c=>{if(!c._img) ponerCaptura(c,demoCaptura(),"captura-de-prueba.jpg")});
}
function demoCaptura(){
  const c=document.createElement("canvas");c.width=640;c.height=240;const g=c.getContext("2d");
  g.fillStyle="#eef3ff";g.fillRect(0,0,640,240);g.fillStyle="#14213D";g.font="bold 26px Arial";g.fillText("CAPTURA DE PRUEBA",30,90);
  g.font="18px Arial";g.fillText("Jefe aprobador: confirmo la solicitud · "+today(),30,140);return c.toDataURL("image/jpeg",.8);
}
async function demoFill(enviar,dep,mov0){
  dep=dep||DEPARTAMENTOS[Math.floor(Math.random()*DEPARTAMENTOS.length)];
  const bs=["demoFill","demoSend","demoBatch"].map($);bs.forEach(b=>{b.dataset.t=b.dataset.t||b.textContent;b.disabled=true});$("demoFill").textContent="Rellenando…";
  try{
    resetForm();
    const mov=mov0||MOVS[Math.floor(Math.random()*MOVS.length)];
    let per=null;
    let motivo="",parcial=false;
    if(CONFIG.endpoint) for(let k=0;k<1&&!per;k++){
      try{const r=await postMaestro({aleatorio:true,departamento:dep});if(r.ok&&r.item) per=r.item;else motivo=r.error||"sin datos"}catch(e){motivo=String(e.message||e)}
      if(!per) await demoTick(1500);
    }
    if(CONFIG.endpoint&&!per){toast("No se pudo leer a la persona del ejemplo desde la base ("+motivo+"). Intenta de nuevo.");bs.forEach(b=>{b.disabled=false;b.textContent=b.dataset.t});return null}
    per=per||{codigo:"0000012345",nombre:"Ana Lucía Torres",puesto:"Analista de Selección",departamento:"GERENCIA DE TALENTO Y CULTURA",area:"Atracción de Talento",seccion:"Selección"};
    dset("movimiento",mov);await demoTick(200);
    if(!$("cargoCliente").value) dset("cargoCliente","Líder de área");
    if(NOCODE.includes(mov)){
      const dep=[...$("departamento").options].find(o=>normalizeTextKey(o.value)===normalizeTextKey(per.departamento));
      if(dep) $("departamento").value=dep.value;
      $("area").value=per.area||"";$("seccion").value=per.seccion||"";
    }else{
      $("codigo").value=per.codigo;setEmployeeFields(per);$("codigoHelp").textContent="Datos de ejemplo cargados desde la base de personal.";
    }
    for(let s=0;s<STEPS.length-1;s++){go(s);await demoTick(150);demoAuto(s)}
    go(STEPS.length-1);$("confirmo").checked=true;
    const faltan=[...STEPS.keys()].slice(0,-1).reduce((n,i)=>n+validate(i).length,0);
    toast((faltan?`Ejemplo cargado (${mov}); ${faltan} campo(s) pendiente(s): revisa los pasos.`:`Ejemplo cargado (${mov}). Pulsa «Enviar solicitud».`));
    afterAuto();
    if(enviar&&!faltan){await submit();bs.forEach(b=>{b.disabled=false;b.textContent=b.dataset.t});return lastRec}
  }catch(e){toast("No se pudo rellenar el ejemplo: "+(e.message||e))}
  bs.forEach(b=>{b.disabled=false;b.textContent=b.dataset.t});
}
// Un registro real por departamento (16): cada BP recibe los de sus departamentos.
async function demoLote(){
  if(!await confirmar("Se enviarán "+DEPARTAMENTOS.length+" solicitudes de ejemplo REALES (una por departamento) a los Socios de negocio.",{titulo:"¿Generar registros de ejemplo?",ok:"Enviar"})) return;
  const por={};let ok=0,fallo=0;
  for(let i=0;i<DEPARTAMENTOS.length;i++){
    $("demoBatch").textContent=`Enviando ${i+1}/${DEPARTAMENTOS.length}…`;
    try{const rec=await demoFill(true,DEPARTAMENTOS[i],MOVS[i%MOVS.length]);const bp=rec&&rec.id&&!rec.sinBP?"Con Socio de negocio":"Sin asignar";por[bp]=(por[bp]||0)+1;rec&&rec.id?ok++:fallo++}catch(e){fallo++}
  }
  $("demoBatch").textContent=$("demoBatch").dataset.t;
  avisar(`Listo: ${ok} enviadas, ${fallo} con problema. Resultado: `+Object.entries(por).map(([k,v])=>`${k}: ${v}`).join(" · "));
}

// ---------- Arranque ----------
let draftTimer;
function onAny(e){
  const el=e.target,isChange=e.type==="change";
  if(el.id==="movimiento"&&isChange){
    const had=[...document.querySelectorAll("[data-dynamic='1']")].some(x=>nonempty(x.value));
    if(had){
      const nuevo=el.value;el.value=prevMov;refresh();
      confirmar("Se borrarán las respuestas que ya escribiste para "+prevMov+".",{titulo:"¿Cambiar el tipo de movimiento?",ok:"Sí, cambiar"}).then(si=>{if(!si) return;el.value=nuevo;renderSpecific();lockNew(true);refresh();store(draftKey(),JSON.stringify({data:gather(),cur,reached}))});
      return;
    }
    renderSpecific();lockNew(true);
  }
  if(el.id==="tieneAprobacion"){
    const yes=el.value==="Sí";
    $("approvalsWrap").classList.toggle("hidden",!yes);
    if(yes&&!$("approvals").children.length) addApproval();
    if(!yes) $("approvals").innerHTML="";
  }
  if(el.id==="codigo"&&isChange) lookupEmployeeByCode();
  if(el.id==="solicitudConcreta") sustentoTouched=true;
  applyWhen();
  const q=el.closest(".q");
  if(q&&q.classList.contains("invalid")&&!check(el)) q.classList.remove("invalid");
  if(el.tagName==="TEXTAREA") counters();
  refresh();
  clearTimeout(draftTimer);
  draftTimer=setTimeout(()=>store(draftKey(),JSON.stringify({data:gather(),cur,reached})),400);
}
function init(){
  $("g0a").innerHTML=G0A.map(qHTML).join("");tarjetasMov();
  $("g0b").innerHTML=G0B.map(qHTML).join("");
  $("g0c").innerHTML=CODE_HTML+G0C.map(qHTML).join("");
  $("g2").innerHTML=qHTML(["tieneAprobacion","¿La solicitud cuenta con aprobación de la gerencia?","select",SN,"La gerencia es el primer filtro. Una conversación en reunión no cuenta como aprobación: debe haber evidencia."]);
  palabras();
  $("g5").innerHTML=qHTML(["solicitudConcreta","Sustento ejecutivo","textarea","Se genera a partir de tus respuestas; puedes editarlo."]);
  $("form").addEventListener("input",onAny);$("form").addEventListener("change",onAny);
  $("stepper").addEventListener("click",e=>{const b=e.target.closest("[data-go]");if(b&&!b.disabled) go(+b.dataset.go)});
  $("prevBtn").onclick=()=>go(cur-1);$("nextBtn").onclick=next;
  $("lookupEmployee").onclick=lookupEmployeeByEmail;
  $("form").addEventListener("click",e=>{const b=e.target.closest(".chip");if(!b) return;const sel=$(b.parentNode.dataset.for);sel.value=b.dataset.v;sel.dispatchEvent(new Event("change",{bubbles:true}))});
  $("g0c").addEventListener("click",e=>{if(e.target.dataset.colab==="manual"){colabManual=true;refresh()}});
  $("correoColab").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();lookupEmployeeByEmail()}});
  $("correoColab").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();lookupEmployeeByEmail()}});
  $("codigo").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();lookupEmployeeByCode()}});
  $("addApproval").onclick=()=>addApproval();
  restorePersistedMaster();
  {
    $("histPeriod").value=today().slice(0,7);
    $("histPeriod").onchange=renderHistory;
    $("loadMaster").onclick=loadMasterFile;$("exportAll").onclick=exportAllPeriod;$("resetSystem").onclick=resetWholeSystem;
    $("historyRows").addEventListener("click",async e=>{
      const b=e.target.closest("[data-act]");if(!b) return;
      const hist=load(HISTORY_KEY,[]),rec=hist.find(r=>r.id===b.dataset.id);if(!rec) return;
      if(b.dataset.act==="xls") return exportCase(rec);
      if(b.dataset.act==="del"){
        if(!await confirmar(`Se borrará completamente este caso de ${rec.periodoLabel}.`,{titulo:"¿Borrar el caso?",ok:"Borrar",peligro:true})) return;
        store(HISTORY_KEY,JSON.stringify(hist.filter(r=>r.id!==rec.id)));
        if(editingCaseId===rec.id) editingCaseId=null;
        return renderHistory();
      }
      resetForm();fill(rec.data);editingCaseId=rec.id;reached=STEPS.length-1;go(0);
      toast("Caso abierto: al guardar se actualiza el mismo registro.");
    });
  }
  $("foot").textContent=CONFIG.soporte?`Soporte: ${CONFIG.soporte}`:"";
  setupLogin();
  boot();
}

// Borradores e historial viven solo en sessionStorage: se borran al cerrar la pestaña (en equipos compartidos no queda nada de los colaboradores).
// ---------- Sesión ----------
// Jefes: nombre y correo @usil.edu.pe (sesión anónima de Firebase; el correo no se verifica). HRBP y Gerencia: correo y clave. Las reglas de Firestore deciden qué ve cada uno.
function saveSession(){try{sessionStorage.setItem(SESSION_KEY,JSON.stringify(SESSION))}catch(e){}}
function readSession(){
  try{const s=JSON.parse(sessionStorage.getItem(SESSION_KEY)||"null");if(s&&Date.now()-s.last<CONFIG.sessionMinutes*60000) return s}catch(e){}
  return null;
}
let lastSave=0;
function touch(){if(!SESSION) return;SESSION.last=Date.now();if(Date.now()-lastSave>15000){lastSave=Date.now();saveSession()}}
const TXT_LG="Entra con tu correo de USIL. Primera vez: tu clave es tu DNI.";
const nombreDeCorreo=m=>String(m).split("@")[0].replace(/[._-]+/g," ").replace(/(^|\s)\S/g,c=>c.toUpperCase());
const titulo=n=>String(n||"").toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase());
function setupLogin(){
  // Acceso de jefe de área: correo institucional y clave (DNI la primera vez). Un Socio de negocio o Gerencia que entra por aquí también pide como jefe;
  // su bandeja está en el otro acceso («Acceso Socio de negocio y Gerencia»), con la misma cuenta.
  $("lgStaff").onclick=async()=>{
    const err=$("lgErr2"),ok=$("lgOk"),b=$("lgStaff"),mail=$("lgMail").value.trim().toLowerCase(),clave=$("lgPass").value;
    err.textContent="";ok.textContent="";
    if(!mail) return void(err.textContent="Ingresa tu correo institucional.");
    if(!clave) return void(err.textContent="Ingresa tu clave.");
    b.disabled=true;
    try{
      const F=await FBp;
      await F.entrarJefe(mail,clave);$("lgPass").value="";
      SESSION={name:nombreDeCorreo(mail),email:mail,role:"jefe",last:Date.now()};saveSession();enter();
    }catch(e){err.textContent=e.message||"No se pudo iniciar sesión."}
    b.disabled=false;
  };
  $("lgPanel").onclick=()=>{location.href=CONFIG.panelUrl};
  $("loginForm").addEventListener("submit",e=>{e.preventDefault();$("lgStaff").click()});
  $("form").addEventListener("submit",e=>e.preventDefault());
  document.querySelector("#login video").addEventListener("error",e=>{e.target.style.display="none"});
  $("logoutBtn").onclick=()=>logout(true);$("mineBtn").onclick=showMine;
  $("demoFill").onclick=()=>demoFill();
  $("demoSend").onclick=()=>demoFill(true);
  $("demoBatch").onclick=demoLote;
  ["click","keydown","input"].forEach(ev=>document.addEventListener(ev,touch,{passive:true}));
  setInterval(()=>{if(SESSION&&Date.now()-SESSION.last>CONFIG.sessionMinutes*60000){logout(false);toast("Sesión cerrada por inactividad. Tu borrador se conservó.")}},30000);
}
async function boot(){
  try{
    const F=await Promise.race([FBp,new Promise((_,no)=>setTimeout(()=>no(new Error("sin Firebase")),10000))]),u=await F.sesion(),s=readSession();
    if(s&&u&&s.email===u.email.toLowerCase().replace(/\+jefe(?=@)/,"")){SESSION=s;return enter()}
    if(u) await F.salir();   // sesión de Firebase sin sesión de pantalla vigente (venció por inactividad)
  }catch(e){}
  showLogin();
}
function showLogin(){
  $("mine").classList.add("hidden");$("login").classList.remove("hidden");$("userChip").classList.add("hidden");$("bpPanel").classList.add("hidden");$("modeTag").textContent="";
  $("lgAyuda").textContent=TXT_LG;
}
function enter(){
  BP_MODE=SESSION.role==="bp";
  $("login").classList.add("hidden");$("userChip").classList.remove("hidden");
  $("userName").textContent=`${SESSION.name} · ${{bp:"BP",gerencia:"Gerencia"}[SESSION.role]||"Líder"}`;
  $("bpPanel").classList.toggle("hidden",!BP_MODE||!!CONFIG.panelUrl);$("modeTag").textContent=(BP_MODE?"· Modo BP":"")+(CONFIG.modoPrueba?" · Modo prueba":"");
  // Relleno de pruebas oculto: 7 clics seguidos en el logo (solo con CONFIG.demoClics). Poner demoClics en false (o quitar este bloque y #demoBar) al pasar a producción.
  {let n=0,t=0;$("logoUsil").onclick=()=>{if(!CONFIG.demoClics)return;const ahora=Date.now();n=ahora-t<1500?n+1:1;t=ahora;if(n>=7){n=0;demoFill()}}}
  if(BP_MODE) renderHistory();
  const dr=load(draftKey(),null);
  editingCaseId=null;reached=0;showShell();
  fill(dr&&dr.data?dr.data:baseData());lockLeader();autoLider();
  if(dr&&dr.data){reached=Math.min(dr.reached||0,STEPS.length-1);go(Math.min(dr.cur||0,reached,STEPS.length-1));toast("Borrador recuperado")}
  else{lockNew(false);go(0)}
}
async function logout(explicit){
  if(explicit&&!await confirmar("Se eliminará el borrador sin enviar de este equipo.",{titulo:"¿Cerrar sesión?",ok:"Cerrar sesión"})) return;
  const key=draftKey(),snap=JSON.stringify({data:gather(),cur,reached});
  try{sessionStorage.removeItem(SESSION_KEY);sessionStorage.removeItem(HISTORY_KEY)}catch(e){}
  FBp.then(F=>F.salir());
  SESSION=null;BP_MODE=false;resetForm();
  explicit?store(key):store(key,snap);
  showLogin();
}
window.addEventListener("error",()=>toast("Ocurrió un error inesperado. Recarga la página; tu borrador se conserva."));
window.addEventListener("unhandledrejection",()=>toast("Ocurrió un error inesperado. Recarga la página; tu borrador se conserva."));
init();

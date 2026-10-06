/**
 * SOLICITUD DE MOVIMIENTO DE TALENTO · USIL
 * Crea AUTOMÁTICAMENTE:
 *   1. Un formulario de Google Forms completo (11 tipos de movimiento, saltos de sección, validaciones y límites).
 *   2. Una hoja «Entradas» (una fila por solicitud), una hoja «Ruteo» (departamento → Business Partner) y una hoja «Log».
 *   3. Un receptor web (doPost) para que la app web (Sistema BP v2.html) envíe sus solicitudes al mismo lugar.
 * Cada solicitud se ASIGNA AUTOMÁTICAMENTE al Business Partner (socio de negocio) del departamento del colaborador,
 * y le llega por correo con el resumen; el jefe de área recibe una confirmación.
 *
 * CÓMO USARLO
 *  1. https://script.google.com › Nuevo proyecto › pega TODO este archivo.
 *  2. Edita CONFIG (COORDINADOR, TOKEN y, si ya la tienes, RUTEO_INICIAL).
 *  3. Ejecuta «crearFormulario» (▶). Autoriza los permisos. Tarda 2 a 4 minutos. En Ver › Registros quedan los enlaces.
 *  4. Abre la hoja «Entradas» › pestaña «Ruteo»: elige de la lista el BP de cada departamento (el correo se completa solo). Los BP salen de la pestaña «BPs».
 *  5. Ejecuta «compartirConBPs» (da acceso de edición a los BP) y, si quieres, «crearVistasPorBP» (una pestaña por BP).
 *  6. Para la app web: Implementar › Nueva implementación › Aplicación web › Ejecutar como: yo › Acceso: cualquiera.
 *     Copia la URL en CONFIG.endpoint de la app web, y el TOKEN en CONFIG.token.
 *  7. Para sacar las entradas: «exportarEntradas» genera un .json y un .csv en tu Drive.
 *
 * NOTAS
 *  - Correo verificado: el formulario exige que respondan con cuenta Google. La app web no tiene esa limitación.
 *  - No se pide DNI. La matrícula se guarda de 10 dígitos.
 *  - Si un departamento no tiene BP en «Ruteo», la solicitud queda «Sin asignar» y se avisa al COORDINADOR.
 *  - Cuota de correo de Apps Script: ~100/día en cuentas personales y ~1500/día en Workspace.
 *  - Los BP con acceso a la hoja ven todas las entradas; para que cada BP vea solo las suyas usa archivos separados.
 */

const CONFIG = {
  TITULO: "Solicitud de Movimiento de Talento",
  COORDINADOR: "creyess@usil.edu.pe",   // César Reyes (Subgerente de Talento y Cultura): recibe lo «Sin asignar» y las fallas de envío
  TOKEN: "e65ae68ed6fbada050fd17c9203b8a19a2c915b3959b4fe2",   // clave que debe enviar la app web (debe coincidir con CONFIG.token de index.html)
  DOMINIOS_PERMITIDOS: ["usil.edu.pe"],   // la app web solo acepta correos de estos dominios
  MAX_POR_CORREO_HORA: 30,         // límite de envíos por correo y por hora (anti-spam)
  MAX_CONSULTAS_HORA: 60,          // consultas al maestro por correo y hora
  MAX_CONSULTAS_DIA: 3000,         // consultas al maestro por día en total
  MAX_GLOBAL_DIA: 300,             // límite total de envíos web por día
  MAX_BYTES: 60000,                // tamaño máximo de una solicitud web
  ENVIAR_CORREOS: true,
  GERENTES: [],                    // correos con la vista de Gerencia (Karla, gerenta): ve todo y da la decisión final. COMPLETAR antes de publicar.
  CARPETA_EXPORT: "Exportaciones BP",
  HOJA_ENTRADAS: "Entradas",
  HOJA_RUTEO: "Ruteo",
  HOJA_LOG: "Log",
  APROBACIONES_MAX: 3,
  // Filas iniciales de «Ruteo»: ["DEPARTAMENTO", "*" o "Área exacta", "Nombre del BP (como en BPS_DIRECTORIO)"]. El correo se completa solo.
  RUTEO_INICIAL: [],
  // Business Partners (Subgerencia de Talento y Cultura, Maestro 05-10-2026). Jefe: César Reyes.
  BPS_DIRECTORIO: [
    ["Fátima Salazar", "msalazar@usil.edu.pe", "Socio de Negocio"],
    ["Melissa Higa", "mhiga@usil.edu.pe", "Socio de Negocio"],
    ["Lesley Reyes", "lreyes@usil.edu.pe", "Socio de Negocio"],
    ["Claudia Muñoz", "cmunozse@usil.edu.pe", "Socio de Negocio"]
  ]
};

const CATALOGO = {
 "comun": {
  "solicitud": [
   {
    "id": "fechaSolicitud",
    "t": "Fecha de solicitud",
    "tipo": "date"
   },
   {
    "id": "cliente",
    "t": "Nombre del líder solicitante",
    "tipo": "text",
    "min": 2,
    "max": 100
   },
   {
    "id": "cargoCliente",
    "t": "Cargo del líder",
    "tipo": "text",
    "min": 2,
    "max": 100
   }
  ],
  "colaborador": [
   {
    "id": "codigo",
    "t": "Matrícula del colaborador (4 a 10 dígitos)",
    "tipo": "text",
    "patron": "[0-9]{4,10}",
    "patronAyuda": "Solo números, de 4 a 10 dígitos (ej. 2458 o 0000002458).",
    "ayuda": "Se completa a 10 dígitos con ceros.",
    "min": 2,
    "max": 100
   },
   {
    "id": "colaborador",
    "t": "Nombre y apellido del colaborador",
    "tipo": "text",
    "min": 2,
    "max": 100
   },
   {
    "id": "puestoActual",
    "t": "Puesto actual",
    "tipo": "text",
    "min": 2,
    "max": 100
   },
   {
    "id": "departamento",
    "t": "Departamento",
    "tipo": "select",
    "opc": [
     "DIRECCION GENERAL DE SEDES DESCENTRALIZADAS",
     "DIRECCION GENERAL DEL CSIR",
     "ESCUELA DE POSGRADO",
     "GERENCIA DE ADMINISTRACION Y SEGURIDAD",
     "GERENCIA DE PROYECTOS - SEDE PERU",
     "GERENCIA DE TALENTO Y CULTURA",
     "GERENCIA GENERAL",
     "GERENCIA LEGAL",
     "GERENCIA SENIOR DE FINANZAS",
     "PRESIDENCIA EJECUTIVA",
     "RECTORADO",
     "VICEPRESIDENCIA DE ASUNTOS CORPORATIVOS",
     "VICEPRESIDENCIA DE COMUNICACIONES E INNOVACION DIG",
     "VICEPRESIDENCIA SENIOR",
     "VICERRECTORADO ACADEMICO",
     "VICERRECTORADO DE INVESTIGACION"
    ],
    "ayuda": "Define a qué Business Partner llega tu solicitud."
   },
   {
    "id": "area",
    "t": "Área",
    "tipo": "text",
    "min": 2,
    "max": 100
   },
   {
    "id": "seccion",
    "t": "Sección",
    "tipo": "text",
    "min": 2,
    "max": 100
   }
  ],
  "area": [
   {
    "id": "departamento",
    "t": "Departamento",
    "tipo": "select",
    "opc": [
     "DIRECCION GENERAL DE SEDES DESCENTRALIZADAS",
     "DIRECCION GENERAL DEL CSIR",
     "ESCUELA DE POSGRADO",
     "GERENCIA DE ADMINISTRACION Y SEGURIDAD",
     "GERENCIA DE PROYECTOS - SEDE PERU",
     "GERENCIA DE TALENTO Y CULTURA",
     "GERENCIA GENERAL",
     "GERENCIA LEGAL",
     "GERENCIA SENIOR DE FINANZAS",
     "PRESIDENCIA EJECUTIVA",
     "RECTORADO",
     "VICEPRESIDENCIA DE ASUNTOS CORPORATIVOS",
     "VICEPRESIDENCIA DE COMUNICACIONES E INNOVACION DIG",
     "VICEPRESIDENCIA SENIOR",
     "VICERRECTORADO ACADEMICO",
     "VICERRECTORADO DE INVESTIGACION"
    ],
    "ayuda": "Define a qué Business Partner llega tu solicitud."
   },
   {
    "id": "area",
    "t": "Área",
    "tipo": "text",
    "min": 2,
    "max": 100
   },
   {
    "id": "seccion",
    "t": "Sección",
    "tipo": "text",
    "min": 2,
    "max": 100
   }
  ],
  "tieneAprobacion": {
   "id": "tieneAprobacion",
   "t": "¿Cuenta con alguna aprobación previa?",
   "tipo": "select",
   "opc": [
    "Sí",
    "No"
   ]
  },
  "aprobacion": [
   {
    "id": "level",
    "t": "Nivel de aprobación",
    "tipo": "select",
    "opc": [
     "Presidencia",
     "Gerencia General",
     "Líder de Unidad",
     "Líder de Área",
     "Líder inmediato",
     "Otro"
    ]
   },
   {
    "id": "name",
    "t": "Nombre del aprobador",
    "tipo": "text",
    "min": 2,
    "max": 100
   },
   {
    "id": "role",
    "t": "Cargo del aprobador",
    "tipo": "text",
    "min": 2,
    "max": 100
   },
   {
    "id": "date",
    "t": "Fecha de aprobación",
    "tipo": "date"
   },
   {
    "id": "evidence",
    "t": "¿Cuenta con evidencia?",
    "tipo": "select",
    "opc": [
     "Sí",
     "No"
    ]
   },
   {
    "id": "type",
    "t": "Tipo de evidencia",
    "tipo": "select",
    "opc": [
     "Correo",
     "Acta",
     "Reunión",
     "Documento",
     "Otro",
     "Sin evidencia"
    ]
   }
  ],
  "presupuesto": [
   {
    "id": "presupuesto",
    "t": "¿Cuenta con presupuesto?",
    "tipo": "select",
    "opc": [
     "Sí",
     "No",
     "Por confirmar"
    ]
   },
   {
    "id": "fuentePresupuesto",
    "t": "Fuente de presupuesto",
    "tipo": "select",
    "opc": [
     "Presupuesto aprobado",
     "Vacante disponible",
     "Ahorro interno",
     "Reasignación",
     "Presupuesto adicional",
     "No identificada",
     "Otro"
    ]
   },
   {
    "id": "validaPresupuesto",
    "t": "Quién confirma o valida el presupuesto",
    "tipo": "text",
    "ayuda": "Nombre, cargo o estado de validación.",
    "min": 3,
    "max": 120
   },
   {
    "id": "montoPresupuesto",
    "t": "Monto disponible en S/ (escribe 0 si no hay)",
    "tipo": "number",
    "numMin": 0
   }
  ],
  "impacto": [
   {
    "id": "urgencia",
    "t": "¿Cuándo se necesita implementar?",
    "tipo": "select",
    "opc": [
     "Inmediato",
     "Dentro de 30 días",
     "Dentro de 60 días",
     "Más adelante"
    ]
   },
   {
    "id": "impacto",
    "t": "Nivel de impacto si no se ejecuta",
    "tipo": "select",
    "opc": [
     "Bajo",
     "Medio",
     "Alto",
     "Crítico"
    ]
   },
   {
    "id": "consecuencia",
    "t": "Principal consecuencia de no aprobar",
    "tipo": "select",
    "opc": [
     "Sin impacto relevante",
     "Retraso operativo",
     "Sobrecarga del equipo",
     "Riesgo de pérdida de talento",
     "Impacto en clientes",
     "Impacto financiero",
     "Riesgo de cumplimiento",
     "Otro"
    ]
   },
   {
    "id": "impactoDetalle",
    "t": "Explique brevemente el impacto",
    "tipo": "textarea",
    "ayuda": "¿Qué pasaría si este movimiento no se ejecuta?",
    "min": 40,
    "max": 500
   }
  ]
 },
 "movs": [
  {
   "nombre": "Promoción",
   "descripcion": "",
   "sinMatricula": false,
   "secciones": [
    {
     "t": "Cambio propuesto",
     "preguntas": [
      {
       "id": "puestoPropuesto",
       "t": "¿A qué puesto se propone promover?",
       "tipo": "text",
       "min": 2,
       "max": 100
      },
      {
       "id": "desdeCuando",
       "t": "¿Desde cuándo realiza o realizará estas funciones?",
       "tipo": "date"
      },
      {
       "id": "posicionExiste",
       "t": "¿Existe la posición en la estructura?",
       "tipo": "select",
       "opc": [
        "Sí",
        "No",
        "Por confirmar"
       ]
      },
      {
       "id": "mayorDecision",
       "t": "¿Tendrá mayor nivel de decisión?",
       "tipo": "select",
       "opc": [
        "Sí",
        "No",
        "Parcialmente"
       ]
      },
      {
       "id": "personasCargo",
       "t": "¿Tendrá personas a cargo? ¿Cuántas?",
       "tipo": "text",
       "min": 1,
       "max": 60
      }
     ]
    },
    {
     "t": "Qué cambió en el rol",
     "preguntas": [
      {
       "id": "queCambioPromo",
       "t": "¿Qué cambió en el rol para que hoy se plantee una promoción?",
       "tipo": "textarea",
       "min": 60,
       "max": 600,
       "ayuda": "Describe el cambio principal en alcance, responsabilidad o complejidad."
      },
      {
       "id": "nuevasResponsabilidades",
       "t": "¿Qué mayor responsabilidad asumirá o ya viene asumiendo?",
       "tipo": "textarea",
       "min": 40,
       "max": 500,
       "ayuda": "Ej.: liderar equipo, manejar presupuesto, tomar decisiones, responder por resultados."
      },
      {
       "id": "mayorAlcance",
       "t": "¿Cómo aumentó el alcance del puesto?",
       "tipo": "textarea",
       "min": 40,
       "max": 500,
       "ayuda": "Ej.: más procesos, clientes, presupuesto, sedes o responsabilidad transversal."
      },
      {
       "id": "funcionesNuevas",
       "t": "¿Qué actividades nuevas realizará?",
       "tipo": "textarea",
       "min": 40,
       "max": 500,
       "ayuda": "Ej.: seguimiento de indicadores, coordinación de reuniones, validación de reportes."
      }
     ]
    },
    {
     "t": "Sustento de la promoción",
     "preguntas": [
      {
       "id": "porQuePromocion",
       "t": "¿Por qué este cambio corresponde a una promoción y no solo a un incremento salarial?",
       "tipo": "textarea",
       "min": 60,
       "max": 600
      }
     ]
    },
    {
     "t": "Resultado esperado e impacto",
     "preguntas": [
      {
       "id": "resultadoEsperadoPromo",
       "t": "¿Qué se logrará al formalizar la promoción?",
       "tipo": "textarea",
       "min": 40,
       "max": 500,
       "ayuda": "Describe el beneficio concreto para el área, el equipo o el negocio."
      },
      {
       "id": "impactoNoPromocion",
       "t": "¿Qué ocurriría si la promoción no se formaliza?",
       "tipo": "textarea",
       "min": 40,
       "max": 500
      }
     ]
    }
   ]
  },
  {
   "nombre": "Encargatura",
   "descripcion": "",
   "sinMatricula": false,
   "secciones": [
    {
     "t": "Tipo de encargatura",
     "preguntas": [
      {
       "id": "tipoEncargatura",
       "t": "Tipo de encargatura",
       "tipo": "select",
       "opc": [
        "Nueva encargatura",
        "Renovación de encargatura",
        "Cambio de encargatura"
       ],
       "ramifica": {
        "Nueva encargatura": "Motivo y vigencia",
        "Renovación de encargatura": "Condiciones de la renovación",
        "Cambio de encargatura": "Condiciones del cambio"
       }
      }
     ]
    },
    {
     "t": "Condiciones de la renovación",
     "saltaA": "Motivo y vigencia",
     "preguntas": [
      {
       "id": "fechaPrimerConvenio",
       "t": "Fecha del primer convenio",
       "tipo": "date"
      },
      {
       "id": "fechaTerminoActual",
       "t": "Fecha de término actual",
       "tipo": "date"
      },
      {
       "id": "periodoRenovacion",
       "t": "¿Por cuánto tiempo se desea renovar?",
       "tipo": "text",
       "min": 2,
       "max": 40,
       "ayuda": "Ej.: 3 meses"
      },
      {
       "id": "mismasFuncionesRen",
       "t": "¿Se mantienen las mismas funciones?",
       "tipo": "select",
       "opc": [
        "Sí",
        "No",
        "Parcialmente"
       ]
      },
      {
       "id": "cambiaMontoRen",
       "t": "¿Cambió el monto de la asignación?",
       "tipo": "select",
       "opc": [
        "Sí",
        "No",
        "Por confirmar"
       ]
      },
      {
       "id": "resultadosRen",
       "t": "¿Qué resultados o evidencias muestran que la encargatura ha funcionado durante el periodo anterior?",
       "tipo": "textarea",
       "min": 30,
       "max": 300,
       "ayuda": "Ej.: se mantuvo el cumplimiento de metas, no hubo interrupciones operativas y el equipo tuvo continuidad de liderazgo."
      }
     ]
    },
    {
     "t": "Condiciones del cambio",
     "preguntas": [
      {
       "id": "puestoEncargaturaAnterior",
       "t": "Posición encargada anterior",
       "tipo": "text",
       "min": 2,
       "max": 100
      },
      {
       "id": "cambiaAsignacionEnc",
       "t": "¿Cambia la asignación económica?",
       "tipo": "select",
       "opc": [
        "Sí",
        "No",
        "Por confirmar"
       ]
      },
      {
       "id": "motivoCambioEnc",
       "t": "¿Por qué cambia la encargatura a una nueva posición?",
       "tipo": "textarea",
       "min": 30,
       "max": 300
      }
     ]
    },
    {
     "t": "Motivo y vigencia",
     "preguntas": [
      {
       "id": "motivoEncargo",
       "t": "¿Qué situación genera la necesidad de la encargatura?",
       "tipo": "select",
       "opc": [
        "Vacaciones",
        "Licencia",
        "Vacante",
        "Cese",
        "Proyecto",
        "Otro"
       ]
      },
      {
       "id": "puestoEncargado",
       "t": "¿Qué posición requiere cobertura?",
       "tipo": "text",
       "min": 2,
       "max": 100
      },
      {
       "id": "aQuienReemplaza",
       "t": "¿A quién reemplaza o qué vacancia cubre?",
       "tipo": "text",
       "min": 3,
       "max": 120
      },
      {
       "id": "fechaInicioEnc",
       "t": "Fecha de inicio",
       "tipo": "date"
      },
      {
       "id": "fechaFinEnc",
       "t": "Fecha estimada de fin",
       "tipo": "date"
      },
      {
       "id": "yaEmpezo",
       "t": "¿La encargatura ya empezó?",
       "tipo": "select",
       "opc": [
        "Sí",
        "No"
       ]
      }
     ]
    },
    {
     "t": "Funciones durante la encargatura",
     "preguntas": [
      {
       "id": "mantieneFunciones",
       "t": "¿Mantendrá sus funciones actuales?",
       "tipo": "select",
       "opc": [
        "Sí",
        "No",
        "Parcialmente"
       ]
      },
      {
       "id": "equipoAdicional",
       "t": "¿Tendrá equipo adicional a cargo?",
       "tipo": "text",
       "min": 1,
       "max": 60
      },
      {
       "id": "responsabilidadesExtra",
       "t": "¿Qué responsabilidades adicionales asumirá?",
       "tipo": "textarea",
       "min": 40,
       "max": 500
      }
     ]
    },
    {
     "t": "Resultado esperado e impacto",
     "preguntas": [
      {
       "id": "resultadoEsperadoEnc",
       "t": "¿Qué se busca asegurar con esta encargatura?",
       "tipo": "textarea",
       "min": 40,
       "max": 500,
       "ayuda": "Ej.: continuidad de liderazgo, cobertura de una vacancia, cumplimiento de metas o continuidad operativa."
      },
      {
       "id": "riesgoNoFormalizar",
       "t": "¿Qué ocurriría si no se formaliza?",
       "tipo": "textarea",
       "min": 40,
       "max": 500
      }
     ]
    }
   ]
  },
  {
   "nombre": "Reemplazo",
   "descripcion": "",
   "sinMatricula": false,
   "secciones": [
    {
     "t": "Posición a reemplazar",
     "preguntas": [
      {
       "id": "puestoReemplazo",
       "t": "¿Qué posición requiere ser reemplazada?",
       "tipo": "text",
       "min": 2,
       "max": 100
      },
      {
       "id": "personaOVacanteReemplazo",
       "t": "¿A quién reemplaza o qué vacante ocupa?",
       "tipo": "text",
       "min": 3,
       "max": 120
      },
      {
       "id": "motivoVacanteReemplazo",
       "t": "¿Cuál es el motivo por el que la posición queda vacante?",
       "tipo": "select",
       "opc": [
        "Renuncia",
        "Cese",
        "Promoción",
        "Traslado",
        "Cambio interno",
        "Otro"
       ]
      },
      {
       "id": "fechaVacanteReemplazo",
       "t": "¿Desde qué fecha se encuentra o se encontrará vacante la posición?",
       "tipo": "date"
      }
     ]
    },
    {
     "t": "Colaborador propuesto",
     "preguntas": [
      {
       "id": "fechaInicioReemplazo",
       "t": "¿Desde qué fecha se propone que el colaborador asuma la posición?",
       "tipo": "date"
      },
      {
       "id": "situacionPuestoActualReemplazo",
       "t": "¿Qué ocurrirá con la posición actual del colaborador propuesto?",
       "tipo": "select",
       "opc": [
        "Quedará vacante",
        "Será cubierta",
        "Se elimina",
        "Por definir",
        "No aplica"
       ]
      },
      {
       "id": "personasCargoReemplazo",
       "t": "¿Tendrá personas a cargo? ¿Cuántas?",
       "tipo": "text",
       "min": 1,
       "max": 60
      },
      {
       "id": "porQueColaboradorReemplazo",
       "t": "¿Por qué se propone a este colaborador para ocupar la posición?",
       "tipo": "textarea",
       "min": 60,
       "max": 600,
       "ayuda": "Ej.: experiencia previa, conocimiento del proceso, resultados, continuidad operativa o preparación para asumir el rol."
      }
     ]
    },
    {
     "t": "Cambios en el rol",
     "preguntas": [
      {
       "id": "responsabilidadesReemplazo",
       "t": "¿Qué responsabilidades asumirá en la nueva posición?",
       "tipo": "textarea",
       "min": 40,
       "max": 500,
       "ayuda": "Describe las principales responsabilidades que asumirá en la posición de destino."
      },
      {
       "id": "cambioAlcanceReemplazo",
       "t": "¿Cómo cambia su alcance, nivel de responsabilidad o toma de decisiones?",
       "tipo": "textarea",
       "min": 40,
       "max": 500,
       "ayuda": "Describe los cambios relevantes frente a su posición actual."
      }
     ]
    },
    {
     "t": "Resultado esperado e impacto",
     "preguntas": [
      {
       "id": "resultadoEsperadoReemplazo",
       "t": "¿Qué se busca asegurar o mejorar con este reemplazo?",
       "tipo": "textarea",
       "min": 40,
       "max": 500,
       "ayuda": "Describe el resultado esperado para el área, equipo u operación."
      },
      {
       "id": "impactoNoReemplazo",
       "t": "¿Qué ocurriría si la posición no se cubre o el reemplazo no se formaliza?",
       "tipo": "textarea",
       "min": 40,
       "max": 500
      }
     ]
    }
   ]
  },
  {
   "nombre": "Puesto nuevo",
   "descripcion": "",
   "sinMatricula": true,
   "secciones": [
    {
     "t": "El puesto solicitado",
     "preguntas": [
      {
       "id": "puestoNuevo",
       "t": "Nombre del puesto solicitado",
       "tipo": "text",
       "min": 2,
       "max": 100
      },
      {
       "id": "temporalPermanente",
       "t": "¿Es permanente o temporal?",
       "tipo": "select",
       "opc": [
        "Permanente",
        "Temporal",
        "Por definir"
       ]
      },
      {
       "id": "reportaA",
       "t": "¿A quién reportará?",
       "tipo": "text",
       "min": 2,
       "max": 100
      },
      {
       "id": "personasCargoPN",
       "t": "¿Tendrá personal a cargo? ¿Cuánto?",
       "tipo": "text",
       "min": 1,
       "max": 60
      },
      {
       "id": "fechaRequerida",
       "t": "Fecha requerida",
       "tipo": "date"
      }
     ]
    },
    {
     "t": "Necesidad del negocio",
     "preguntas": [
      {
       "id": "necesidadPuesto",
       "t": "¿Qué necesidad del negocio origina la creación del puesto?",
       "tipo": "textarea",
       "min": 60,
       "max": 600,
       "ayuda": "Explica brevemente qué está pasando en el área o negocio."
      },
      {
       "id": "problemaResuelve",
       "t": "¿Qué problema existe actualmente por no contar con esta posición?",
       "tipo": "textarea",
       "min": 60,
       "max": 600
      },
      {
       "id": "porQueNoAbsorbe",
       "t": "¿Por qué la estructura actual no puede absorber esta necesidad?",
       "tipo": "textarea",
       "min": 60,
       "max": 600
      },
      {
       "id": "similarOtraUnidad",
       "t": "¿Existe una posición similar en otra unidad?",
       "tipo": "select",
       "opc": [
        "Sí",
        "No",
        "Por confirmar"
       ]
      }
     ]
    },
    {
     "t": "Alcance del puesto",
     "preguntas": [
      {
       "id": "responsabilidadesPuesto",
       "t": "¿Qué responsabilidades tendrá el puesto?",
       "tipo": "textarea",
       "min": 60,
       "max": 600,
       "ayuda": "Ej.: coordinar al equipo, supervisar la operación, tomar decisiones, controlar indicadores."
      },
      {
       "id": "entregables",
       "t": "¿Qué resultados concretos deberá entregar?",
       "tipo": "textarea",
       "min": 40,
       "max": 500,
       "ayuda": "Ej.: cumplimiento de SLA, reducción de incidencias, cierre mensual, mejora de indicadores."
      }
     ]
    },
    {
     "t": "Resultado esperado e impacto",
     "preguntas": [
      {
       "id": "mejoraEsperadaPN",
       "t": "¿Qué cambiará o mejorará concretamente con la creación de este puesto?",
       "tipo": "textarea",
       "min": 40,
       "max": 500,
       "ayuda": "Describe el beneficio esperado para la operación, el equipo o el negocio."
      },
      {
       "id": "impactoNoCrear",
       "t": "¿Qué ocurriría si el puesto no se crea?",
       "tipo": "textarea",
       "min": 40,
       "max": 500
      }
     ]
    }
   ],
   "tituloArea": "Posición nueva",
   "colaboradorFijo": "Vacante nueva"
  },
  {
   "nombre": "Incremento salarial",
   "descripcion": "",
   "sinMatricula": false,
   "secciones": [
    {
     "t": "Motivo y situación",
     "preguntas": [
      {
       "id": "motivoIncremento",
       "t": "Motivo principal del incremento",
       "tipo": "select",
       "opc": [
        "Retención",
        "Equidad interna",
        "Ampliación de responsabilidades",
        "Mérito",
        "Regularización",
        "Contraoferta",
        "Obtención de Grado Académico",
        "Otro"
       ]
      },
      {
       "id": "desdeCuandoInc",
       "t": "¿Desde cuándo se presenta esta situación?",
       "tipo": "date"
      },
      {
       "id": "situacionOrigen",
       "t": "¿Qué situación origina la solicitud?",
       "tipo": "textarea",
       "min": 60,
       "max": 600
      },
      {
       "id": "queCambio",
       "t": "¿Qué cambió en el puesto, desempeño o contexto que sustenta la revisión?",
       "tipo": "textarea",
       "min": 60,
       "max": 600
      }
     ]
    },
    {
     "t": "Evidencia y riesgo de salida",
     "preguntas": [
      {
       "id": "riesgoSalida",
       "t": "¿Existe riesgo de salida?",
       "tipo": "select",
       "opc": [
        "Sí",
        "No",
        "No se sabe"
       ]
      },
      {
       "id": "ofertaExterna",
       "t": "¿Existe oferta externa?",
       "tipo": "select",
       "opc": [
        "Sí",
        "No",
        "No se sabe"
       ]
      },
      {
       "id": "intencionRenuncia",
       "t": "¿Comunicó intención de renuncia?",
       "tipo": "select",
       "opc": [
        "Sí",
        "No",
        "No se sabe"
       ]
      },
      {
       "id": "evidenciaRiesgo",
       "t": "¿Qué evidencia concreta respalda la solicitud?",
       "tipo": "textarea",
       "min": 60,
       "max": 600
      },
      {
       "id": "impactoSalida",
       "t": "¿Qué impacto tendría una eventual salida o no atender la revisión?",
       "tipo": "textarea",
       "min": 40,
       "max": 500
      }
     ]
    },
    {
     "t": "Resultado esperado",
     "preguntas": [
      {
       "id": "resultadoEsperadoInc",
       "t": "¿Qué se busca lograr con la revisión salarial?",
       "tipo": "textarea",
       "min": 40,
       "max": 500,
       "ayuda": "Ej.: corregir equidad, retener talento, reconocer una ampliación sostenida de responsabilidades."
      }
     ]
    },
    {
     "t": "Propuesta del negocio",
     "preguntas": [
      {
       "id": "tipoPropuestaNegocio",
       "t": "Tipo de propuesta del negocio",
       "tipo": "select",
       "opc": [
        "Monto en S/",
        "Porcentaje %"
       ]
      },
      {
       "id": "propuestaNegocio",
       "t": "Valor de la propuesta",
       "tipo": "number",
       "numMin": 1
      }
     ]
    }
   ]
  },
  {
   "nombre": "Movimiento lateral",
   "descripcion": "Cambio de un colaborador a otro puesto de nivel equivalente.",
   "sinMatricula": false,
   "secciones": [
    {
     "t": "Necesidad",
     "preguntas": [
      {
       "id": "motivoMovimiento",
       "t": "¿Qué necesidad origina el movimiento lateral?",
       "tipo": "textarea",
       "min": 60,
       "max": 600
      },
      {
       "id": "problemaResuelveML",
       "t": "¿Qué problema organizacional busca resolver?",
       "tipo": "textarea",
       "min": 40,
       "max": 500
      }
     ]
    },
    {
     "t": "Destino",
     "preguntas": [
      {
       "id": "puestoDestino",
       "t": "Puesto destino",
       "tipo": "text",
       "min": 2,
       "max": 100
      },
      {
       "id": "areaDestino",
       "t": "Área destino",
       "tipo": "text",
       "min": 2,
       "max": 100
      },
      {
       "id": "cambioUbicacion",
       "t": "¿Existe cambio de ubicación?",
       "tipo": "select",
       "opc": [
        "Sí",
        "No"
       ]
      },
      {
       "id": "cambioJornada",
       "t": "¿Existe cambio de jornada?",
       "tipo": "select",
       "opc": [
        "Sí",
        "No"
       ]
      }
     ]
    },
    {
     "t": "Cambios en el rol",
     "preguntas": [
      {
       "id": "cambiaResponsabilidad",
       "t": "¿Cambia el nivel de responsabilidad?",
       "tipo": "select",
       "opc": [
        "Sí",
        "No",
        "Parcialmente"
       ]
      },
      {
       "id": "cambiaAlcance",
       "t": "¿Cómo cambia el alcance?",
       "tipo": "textarea",
       "min": 40,
       "max": 500
      },
      {
       "id": "nuevasFuncionesML",
       "t": "¿Qué funciones nuevas asumirá?",
       "tipo": "textarea",
       "min": 40,
       "max": 500
      }
     ]
    },
    {
     "t": "Resultado esperado e impacto",
     "preguntas": [
      {
       "id": "resultadoEsperadoML",
       "t": "¿Qué se espera lograr con el movimiento?",
       "tipo": "textarea",
       "min": 40,
       "max": 500
      },
      {
       "id": "solicitaIncrementoML",
       "t": "¿El cliente solicita incremento salarial?",
       "tipo": "select",
       "opc": [
        "Sí",
        "No",
        "Por confirmar"
       ]
      }
     ]
    }
   ]
  },
  {
   "nombre": "Movimiento horizontal",
   "descripcion": "Ampliación, rotación o cambio de funciones de un colaborador sin cambiar de puesto ni de nivel.",
   "sinMatricula": false,
   "secciones": [
    {
     "t": "Situación y tipo de cambio",
     "preguntas": [
      {
       "id": "tipoHorizontal",
       "t": "Tipo de movimiento horizontal",
       "tipo": "select",
       "opc": [
        "Ampliación de funciones",
        "Rotación de funciones",
        "Apoyo a otra área",
        "Cambio de línea de reporte",
        "Otro"
       ]
      },
      {
       "id": "esTemporalHorizontal",
       "t": "¿Es temporal o permanente?",
       "tipo": "select",
       "opc": [
        "Permanente",
        "Temporal",
        "Por definir"
       ]
      },
      {
       "id": "desdeCuandoHorizontal",
       "t": "¿Desde cuándo se realiza o realizará?",
       "tipo": "date"
      },
      {
       "id": "motivoHorizontal",
       "t": "¿Qué necesidad origina el movimiento horizontal?",
       "tipo": "textarea",
       "min": 60,
       "max": 600
      }
     ]
    },
    {
     "t": "Qué cambia en el rol",
     "preguntas": [
      {
       "id": "funcionesActualesHorizontal",
       "t": "¿Qué funciones mantiene en su puesto actual?",
       "tipo": "textarea",
       "min": 30,
       "max": 300
      },
      {
       "id": "funcionesNuevasHorizontal",
       "t": "¿Qué funciones nuevas o distintas asumirá?",
       "tipo": "textarea",
       "min": 40,
       "max": 500
      },
      {
       "id": "areaApoyoHorizontal",
       "t": "¿Con qué área o jefatura coordinará o a quién reportará?",
       "tipo": "text",
       "min": 3,
       "max": 120
      },
      {
       "id": "cambiaJefeHorizontal",
       "t": "¿Cambia su jefe directo?",
       "tipo": "select",
       "opc": [
        "Sí",
        "No"
       ]
      },
      {
       "id": "cambiaNivelHorizontal",
       "t": "¿Cambia su nivel o banda del puesto?",
       "tipo": "select",
       "opc": [
        "Sí",
        "No",
        "Por confirmar"
       ]
      }
     ]
    },
    {
     "t": "Resultado esperado e impacto",
     "preguntas": [
      {
       "id": "resultadoEsperadoHorizontal",
       "t": "¿Qué se espera lograr con el movimiento?",
       "tipo": "textarea",
       "min": 40,
       "max": 500
      },
      {
       "id": "solicitaIncrementoHorizontal",
       "t": "¿Se solicita compensación adicional (asignación o incremento)?",
       "tipo": "select",
       "opc": [
        "Sí",
        "No",
        "Por confirmar"
       ]
      },
      {
       "id": "impactoNoHorizontal",
       "t": "¿Qué ocurriría si el movimiento no se realiza?",
       "tipo": "textarea",
       "min": 40,
       "max": 500
      }
     ]
    }
   ]
  },
  {
   "nombre": "Reestructuración de área",
   "descripcion": "Cambio en la estructura de un área que involucra a varios colaboradores (reubicaciones, posiciones creadas o eliminadas, cambios de reporte).",
   "sinMatricula": true,
   "secciones": [
    {
     "t": "Contexto de la reestructuración",
     "preguntas": [
      {
       "id": "areaReestructura",
       "t": "¿Qué área o unidad se reestructura?",
       "tipo": "text",
       "min": 2,
       "max": 100
      },
      {
       "id": "fechaVigenciaReestructura",
       "t": "Fecha propuesta de entrada en vigencia",
       "tipo": "date"
      },
      {
       "id": "aprobadaReestructura",
       "t": "¿La reestructuración ya fue aprobada por la Dirección o Unidad?",
       "tipo": "select",
       "opc": [
        "Sí",
        "No",
        "Por confirmar"
       ]
      },
      {
       "id": "motivoReestructura",
       "t": "¿Qué situación origina la reestructuración?",
       "tipo": "textarea",
       "min": 60,
       "max": 600
      },
      {
       "id": "objetivoReestructura",
       "t": "¿Qué se busca lograr con la nueva estructura?",
       "tipo": "textarea",
       "min": 60,
       "max": 600
      }
     ]
    },
    {
     "t": "Alcance de los cambios",
     "preguntas": [
      {
       "id": "nPersonasAfectadas",
       "t": "Número de colaboradores afectados",
       "tipo": "number",
       "numMin": 1
      },
      {
       "id": "tipoCambioReestructura",
       "t": "Principal tipo de cambio",
       "tipo": "select",
       "opc": [
        "Reubicación de personas",
        "Cambio de líneas de reporte",
        "Creación de posiciones",
        "Eliminación de posiciones",
        "Combinación de varios cambios"
       ]
      },
      {
       "id": "posicionesCreadas",
       "t": "Posiciones nuevas que se crean",
       "tipo": "select",
       "opc": [
        "Ninguna",
        "1",
        "2",
        "3 o más"
       ]
      },
      {
       "id": "posicionesEliminadas",
       "t": "Posiciones que se eliminan",
       "tipo": "select",
       "opc": [
        "Ninguna",
        "1",
        "2",
        "3 o más"
       ]
      },
      {
       "id": "detalleMovimientosRest",
       "t": "Detalle de movimientos: una línea por colaborador (matrícula · nombre · posición actual → posición propuesta · área destino)",
       "tipo": "textarea",
       "min": 60,
       "max": 1500,
       "ayuda": "Ej.: 0000002458 · Lucía Ramos · Analista Senior → Coordinadora · Área Comercial"
      },
      {
       "id": "cambiosReporteRest",
       "t": "¿Qué cambios hay en las líneas de reporte?",
       "tipo": "textarea",
       "min": 30,
       "max": 300
      }
     ]
    },
    {
     "t": "Impacto económico",
     "preguntas": [
      {
       "id": "cambiosSalarialesRest",
       "t": "¿La reestructuración implica cambios salariales o de nivel?",
       "tipo": "select",
       "opc": [
        "Sí",
        "No",
        "Por confirmar"
       ]
      },
      {
       "id": "impactoPresupuestalRest",
       "t": "Impacto presupuestal esperado",
       "tipo": "select",
       "opc": [
        "Neutro",
        "Ahorro",
        "Costo adicional",
        "Por determinar"
       ]
      },
      {
       "id": "detalleEconomicoRest",
       "t": "Explique el impacto económico y salarial",
       "tipo": "textarea",
       "min": 40,
       "max": 500
      }
     ]
    },
    {
     "t": "Resultado esperado e impacto",
     "preguntas": [
      {
       "id": "riesgosPersonasRest",
       "t": "¿Qué riesgos hay para el clima o la retención de las personas afectadas?",
       "tipo": "textarea",
       "min": 40,
       "max": 500
      },
      {
       "id": "resultadoEsperadoRest",
       "t": "¿Qué resultado se espera lograr?",
       "tipo": "textarea",
       "min": 40,
       "max": 500
      },
      {
       "id": "impactoNoRest",
       "t": "¿Qué ocurriría si la reestructuración no se ejecuta?",
       "tipo": "textarea",
       "min": 40,
       "max": 500
      }
     ]
    }
   ],
   "tituloArea": "Área que se reestructura",
   "colaboradorFijo": "Varios colaboradores"
  },
  {
   "nombre": "Revalorización de puesto",
   "descripcion": "",
   "sinMatricula": false,
   "secciones": [
    {
     "t": "Situación que origina la revisión",
     "preguntas": [
      {
       "id": "queCambioRev",
       "t": "¿Qué situación origina la revisión del puesto?",
       "tipo": "textarea",
       "min": 60,
       "max": 600
      },
      {
       "id": "desdeCuandoRev",
       "t": "¿Desde cuándo se mantienen estos cambios?",
       "tipo": "date"
      },
      {
       "id": "cambioPermanente",
       "t": "¿Los cambios son permanentes?",
       "tipo": "select",
       "opc": [
        "Sí",
        "No",
        "Por confirmar"
       ]
      }
     ]
    },
    {
     "t": "Cambios en el puesto",
     "preguntas": [
      {
       "id": "nuevasRespRev",
       "t": "¿Qué nuevas responsabilidades se incorporaron?",
       "tipo": "textarea",
       "min": 40,
       "max": 500
      },
      {
       "id": "cambioAlcanceRev",
       "t": "¿Cómo cambió el alcance del puesto?",
       "tipo": "textarea",
       "min": 40,
       "max": 500
      },
      {
       "id": "cambioPersonasRev",
       "t": "¿Cambió el número de personas a cargo?",
       "tipo": "text",
       "min": 1,
       "max": 60
      },
      {
       "id": "cambioPresupuestoRev",
       "t": "¿Cambió la responsabilidad presupuestal?",
       "tipo": "textarea",
       "min": 30,
       "max": 300
      },
      {
       "id": "cambioDecisionRev",
       "t": "¿Cambió el nivel de decisión?",
       "tipo": "textarea",
       "min": 30,
       "max": 300
      },
      {
       "id": "funcionesOtroPuesto",
       "t": "¿Absorbió funciones de otro puesto?",
       "tipo": "textarea",
       "min": 30,
       "max": 300
      }
     ]
    },
    {
     "t": "Sustento",
     "preguntas": [
      {
       "id": "sustentoSubvaloracion",
       "t": "¿Por qué la valoración actual ya no representa el contenido real del puesto?",
       "tipo": "textarea",
       "min": 60,
       "max": 600
      },
      {
       "id": "jdActualizada",
       "t": "¿Existe descripción de puesto actualizada?",
       "tipo": "select",
       "opc": [
        "Sí",
        "No",
        "En proceso"
       ]
      }
     ]
    },
    {
     "t": "Resultado esperado",
     "preguntas": [
      {
       "id": "resultadoEsperadoRev",
       "t": "¿Qué se busca corregir o alinear con la revalorización?",
       "tipo": "textarea",
       "min": 40,
       "max": 500
      }
     ]
    }
   ]
  },
  {
   "nombre": "Convenio / caso especial",
   "descripcion": "",
   "sinMatricula": false,
   "secciones": [
    {
     "t": "El caso",
     "preguntas": [
      {
       "id": "tipoCasoEspecial",
       "t": "Tipo de convenio / caso",
       "tipo": "text",
       "min": 3,
       "max": 100
      },
      {
       "id": "vigenciaCaso",
       "t": "Vigencia o duración",
       "tipo": "text",
       "min": 2,
       "max": 60
      },
      {
       "id": "objetivoCaso",
       "t": "¿Qué necesidad origina la solicitud?",
       "tipo": "textarea",
       "min": 60,
       "max": 600
      }
     ]
    },
    {
     "t": "Sustento, resultado e impacto",
     "preguntas": [
      {
       "id": "sustentoCaso",
       "t": "¿Qué elementos sustentan el caso?",
       "tipo": "textarea",
       "min": 60,
       "max": 600
      },
      {
       "id": "resultadoEsperadoCaso",
       "t": "¿Qué resultado se espera lograr?",
       "tipo": "textarea",
       "min": 40,
       "max": 500
      },
      {
       "id": "impactoCaso",
       "t": "¿Qué ocurriría si no se atiende?",
       "tipo": "textarea",
       "min": 40,
       "max": 500
      }
     ]
    }
   ]
  },
  {
   "nombre": "Otro",
   "descripcion": "",
   "sinMatricula": false,
   "secciones": [
    {
     "t": "La solicitud",
     "preguntas": [
      {
       "id": "descripcionOtro",
       "t": "¿Qué movimiento o decisión se solicita?",
       "tipo": "textarea",
       "min": 60,
       "max": 600
      },
      {
       "id": "sustentoOtro",
       "t": "¿Qué situación origina la solicitud?",
       "tipo": "textarea",
       "min": 60,
       "max": 600
      }
     ]
    },
    {
     "t": "Resultado esperado e impacto",
     "preguntas": [
      {
       "id": "resultadoEsperadoOtro",
       "t": "¿Qué se espera lograr?",
       "tipo": "textarea",
       "min": 40,
       "max": 500
      },
      {
       "id": "impactoOtro",
       "t": "¿Qué ocurriría si no se atiende?",
       "tipo": "textarea",
       "min": 40,
       "max": 500
      }
     ]
    }
   ]
  }
 ],
 "departamentos": [
  "DIRECCION GENERAL DE SEDES DESCENTRALIZADAS",
  "DIRECCION GENERAL DEL CSIR",
  "ESCUELA DE POSGRADO",
  "GERENCIA DE ADMINISTRACION Y SEGURIDAD",
  "GERENCIA DE PROYECTOS - SEDE PERU",
  "GERENCIA DE TALENTO Y CULTURA",
  "GERENCIA GENERAL",
  "GERENCIA LEGAL",
  "GERENCIA SENIOR DE FINANZAS",
  "PRESIDENCIA EJECUTIVA",
  "RECTORADO",
  "VICEPRESIDENCIA DE ASUNTOS CORPORATIVOS",
  "VICEPRESIDENCIA DE COMUNICACIONES E INNOVACION DIG",
  "VICEPRESIDENCIA SENIOR",
  "VICERRECTORADO ACADEMICO",
  "VICERRECTORADO DE INVESTIGACION"
 ]
};

const SIN_EVIDENCIA = "Sin evidencia";

// ============================================================ CREACIÓN DEL FORMULARIO
function crearFormulario() {
  const form = FormApp.create(CONFIG.TITULO);
  configurar_(form);

  // --- Sección 1: solicitud y líder (el BP se asigna solo según el departamento)
  CATALOGO.comun.solicitud.forEach(q => agregar_(form, q));
  const itMov = form.addListItem().setTitle("Tipo de movimiento").setRequired(true)
    .setHelpText("Lateral: cambio a un puesto de nivel equivalente. Horizontal: ampliación o cambio de funciones sin cambiar de puesto. Reestructuración: cambio de estructura de un área con varias personas.");

  // --- Cadena de secciones por movimiento
  const inicio = {}, finales = [], ramas = [];
  CATALOGO.movs.forEach(m => {
    const pcol = form.addPageBreakItem().setTitle(m.nombre + " · " + (m.sinMatricula ? m.tituloArea : "Colaborador"))
      .setHelpText((m.descripcion || "") + " Tu solicitud se enviará al Business Partner del departamento que indiques.");
    inicio[m.nombre] = pcol;
    (m.sinMatricula ? CATALOGO.comun.area : CATALOGO.comun.colaborador).forEach(q => agregar_(form, q));
    const paginas = {};
    let ultima = pcol;
    m.secciones.forEach(s => {
      const pb = form.addPageBreakItem().setTitle(m.nombre + " · " + s.t);
      paginas[s.t] = pb; ultima = pb;
      s.preguntas.forEach(q => {
        const it = agregar_(form, q);
        if (q.ramifica) ramas.push({ it, q, paginas });
      });
    });
    m.secciones.forEach(s => { if (s.saltaA) paginas[s.t].setGoToPage(paginas[s.saltaA]); });
    finales.push(ultima);
  });
  ramas.forEach(r => r.it.setChoices(r.q.opc.map(v => r.it.createChoice(v, r.paginas[r.q.ramifica[v]]))));
  itMov.setChoices(CATALOGO.movs.map(m => itMov.createChoice(m.nombre, inicio[m.nombre])));

  // --- Aprobaciones (hasta 3, con saltos)
  const pAprob = form.addPageBreakItem().setTitle("Aprobaciones previas")
    .setHelpText("Si ya existe una aprobación, regístrala con su nivel, aprobador, fecha y evidencia.");
  const itTiene = agregar_(form, CATALOGO.comun.tieneAprobacion);
  const apr = [];
  for (let n = 1; n <= CONFIG.APROBACIONES_MAX; n++) {
    const pb = form.addPageBreakItem().setTitle("Aprobación " + n);
    CATALOGO.comun.aprobacion.forEach(q => agregar_(form, Object.assign({}, q, { t: "Aprobación " + n + " · " + q.t })));
    const otra = n < CONFIG.APROBACIONES_MAX
      ? agregar_(form, { t: "¿Desea registrar otra aprobación? (después de la " + n + ")", tipo: "select", opc: ["Sí", "No"] }) : null;
    apr.push({ pb, otra });
  }

  // --- Presupuesto, impacto, confirmación
  const pPres = form.addPageBreakItem().setTitle("Presupuesto");
  CATALOGO.comun.presupuesto.forEach(q => agregar_(form, q));
  form.addPageBreakItem().setTitle("Prioridad e impacto");
  CATALOGO.comun.impacto.forEach(q => agregar_(form, q));
  form.addPageBreakItem().setTitle("Confirmación");
  form.addCheckboxItem().setTitle("Confirmo que la información es veraz y cuenta con el respaldo indicado")
    .setChoiceValues(["Confirmo"]).setRequired(true);

  // --- Saltos de aprobaciones y cierre de cada cadena
  itTiene.setChoices([itTiene.createChoice("Sí", apr[0].pb), itTiene.createChoice("No", pPres)]);
  apr.forEach((a, i) => {
    if (a.otra) a.otra.setChoices([a.otra.createChoice("Sí", apr[i + 1].pb), a.otra.createChoice("No", pPres)]);
  });
  finales.forEach(p => p.setGoToPage(pAprob));

  // --- Hojas y activador
  const ss = SpreadsheetApp.create("Entradas – " + CONFIG.TITULO);
  prepararHoja_(ss.getActiveSheet().setName(CONFIG.HOJA_ENTRADAS));
  prepararRuteo_(ss);
  ss.insertSheet(CONFIG.HOJA_LOG).appendRow(["Fecha", "Contexto", "Detalle"]);
  const props = PropertiesService.getScriptProperties();
  props.setProperty("FORM_ID", form.getId());
  props.setProperty("SS_ID", ss.getId());
  ScriptApp.newTrigger("alEnviar").forForm(form).onFormSubmit().create();

  Logger.log("ENLACE PARA COMPARTIR (jefes de área): " + form.getPublishedUrl());
  Logger.log("ENLACE DE EDICIÓN (solo tú): " + form.getEditUrl());
  Logger.log("HOJA DE ENTRADAS Y RUTEO: " + ss.getUrl());
  return { publicar: form.getPublishedUrl(), editar: form.getEditUrl(), hoja: ss.getUrl() };
}

function configurar_(form) {
  form.setDescription("Registra una solicitud de movimiento de talento. Responde con hechos concretos: tu solicitud llega automáticamente al Business Partner de tu departamento y de ahí a Compensaciones y al Comité. Todas las preguntas son obligatorias. La matrícula del colaborador se pide de 4 a 10 dígitos; no se solicita DNI.");
  form.setCollectEmail(true);
  form.setAllowResponseEdits(true);
  form.setProgressBar(true);
  form.setShowLinkToRespondAgain(true);
  form.setConfirmationMessage("Tu solicitud fue registrada y enviada a tu Business Partner. Recibirás un correo de confirmación.");
  try { form.setRequireLogin(true); } catch (e) { Logger.log("setRequireLogin no disponible en esta cuenta: " + e); }
  try { form.setLimitOneResponsePerUser(false); } catch (e) { /* solo aplica con login */ }
}

function agregar_(form, q) {
  let it;
  const lim = (q.min != null) ? (q.tipo === "textarea" ? "Mínimo " + q.min + " caracteres (máximo recomendado " + q.max + ")." : "Entre " + q.min + " y " + q.max + " caracteres.") : "";
  switch (q.tipo) {
    case "textarea":
      it = form.addParagraphTextItem();
      // Google Forms rechaza la regex de longitud en párrafos: se exige el mínimo con la regla nativa y el máximo queda como guía.
      it.setValidation(FormApp.createParagraphTextValidation().setHelpText(lim)
        .requireTextLengthGreaterThanOrEqualTo(q.min).build());
      break;
    case "text":
      it = form.addTextItem();
      it.setValidation(FormApp.createTextValidation().setHelpText(q.patronAyuda || lim)
        .requireTextMatchesPattern(q.patron || (".{" + q.min + "," + q.max + "}")).build());
      break;
    case "number":
      it = form.addTextItem();
      it.setValidation((q.numMin === 0
        ? FormApp.createTextValidation().setHelpText("Ingresa un número mayor o igual a 0.").requireNumberGreaterThanOrEqualTo(0)
        : FormApp.createTextValidation().setHelpText("Ingresa un número mayor que 0.").requireNumberGreaterThan(0)).build());
      break;
    case "date":
      it = form.addDateItem();
      break;
    case "select":
      it = form.addListItem();
      if (q.opc) it.setChoiceValues(q.opc);
      break;
    default:
      throw new Error("Tipo no soportado: " + q.tipo);
  }
  it.setTitle(q.t).setRequired(true);
  const ayuda = [q.ayuda, q.tipo === "textarea" ? lim : ""].filter(Boolean).join(" ");
  if (ayuda) it.setHelpText(ayuda);
  return it;
}

// ============================================================ HOJA «ENTRADAS»
// [encabezado, clave]. Claves con "_" son especiales; el resto sale de rec o de rec.data.
const COLS = [
  ["ID entrada", "id"], ["Enviado el", "enviadoEl"], ["Enviado por (correo)", "enviadoPor"], ["Origen", "origen"], ["Periodo", "periodo"],
  ["Tipo de movimiento", "movimiento"], ["Fecha de solicitud", "fechaSolicitud"], ["Líder solicitante", "cliente"], ["Cargo del líder", "cargoCliente"],
  ["Matrícula", "codigo"], ["Colaborador", "colaborador"], ["Puesto actual", "puestoActual"], ["Departamento", "departamento"], ["Área", "area"], ["Sección", "seccion"],
  ["BP asignado", "bp"], ["Correo BP", "bpCorreo"], ["¿Aprobación previa?", "tieneAprobacion"], ["Presupuesto", "presupuesto"],
  ["Fuente de presupuesto", "fuentePresupuesto"], ["Quién valida", "validaPresupuesto"], ["Monto (S/)", "montoPresupuesto"], ["Urgencia", "urgencia"],
  ["Impacto", "impacto"], ["Consecuencia", "consecuencia"], ["Detalle del impacto", "impactoDetalle"], ["Sustento ejecutivo", "solicitudConcreta"],
  ["Levantamiento (JSON)", "_dyn"], ["Aprobaciones (JSON)", "_apr"], ["Estado", "estado"], ["Comentario BP", "comentarioBP"], ["Enlace de edición", "editUrl"], ["Comentario gerencia", "comentarioGerencia"],
  ["Puntaje (0-100)", "puntaje"], ["Clasificación", "clasificacion"], ["Fortalezas", "fortalezas"], ["Alertas", "alertas"], ["Recomendación", "recomendacion"]   // solo las solicitudes de la app web los traen
];
const TOP = ["id", "enviadoEl", "enviadoPor", "origen", "periodo", "bpCorreo", "estado", "comentarioBP", "editUrl", "comentarioGerencia"];
// Flujo: Jefe envía (Nuevo) → BP revisa → «Devuelto al jefe» (corrige y reenvía) o «Enviado a Gerencia» → Gerencia: Aprobado / Rechazado / vuelve al BP.
const ESTADOS = ["Nuevo", "En revisión BP", "Devuelto al jefe", "Enviado a Gerencia", "Aprobado", "Rechazado", "En pausa"];
const ESTADOS_BP = ["En revisión BP", "Devuelto al jefe", "Enviado a Gerencia", "En pausa"];   // opciones que elige el BP
const EDITABLE_BP = ["Nuevo", "En revisión BP", "Devuelto al jefe", "En pausa"];             // estados en los que el BP puede actuar
const ESTADOS_GER = ["Enviado a Gerencia", "Aprobado", "Rechazado", "En revisión BP"];       // opciones de Gerencia («En revisión BP» = devolver al BP)
const EDITABLE_GER = ["Enviado a Gerencia", "Aprobado", "Rechazado"];
const VISIBLE_GER = EDITABLE_GER;                                                            // Gerencia solo ve lo que el BP le pasó
const colIdx_ = clave => COLS.findIndex(c => c[1] === clave);

function prepararHoja_(sh) {
  sh.clear();
  sh.getRange(1, 1, sh.getMaxRows(), COLS.length).setNumberFormat("@");        // todo como texto: conserva ceros de la matrícula y evita fórmulas
  sh.getRange(1, 1, 1, COLS.length).setValues([COLS.map(c => c[0])]).setFontWeight("bold").setBackground("#00195A").setFontColor("#FFFFFF");
  sh.setFrozenRows(1); sh.setFrozenColumns(6);
  sh.getRange(1, 1, 1, COLS.length).createFilter();
  sh.getRange(2, colIdx_("estado") + 1, 2000, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(ESTADOS, true).build());
}

function valorCol_(rec, clave) {
  if (clave === "_dyn") return JSON.stringify(rec.data.dynamic || {});
  if (clave === "_apr") return JSON.stringify(rec.data.approvals || []);
  if (clave === "bpCorreo") return rec.bpCorreo || "";
  const v = TOP.indexOf(clave) >= 0 ? rec[clave] : rec.data[clave];
  return v == null ? "" : String(v);
}

function hojaEntradas_() {
  return SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SS_ID")).getSheetByName(CONFIG.HOJA_ENTRADAS);
}

/** Inserta la fila o, si el ID ya existe (edición desde la web), la actualiza conservando Estado y Comentario BP. */
function guardarFila_(rec) {
  const sh = hojaEntradas_();
  const fila = COLS.map(c => valorCol_(rec, c[1]));
  const hit = sh.createTextFinder(rec.id).matchEntireCell(true).findNext();
  if (hit && hit.getColumn() === 1) {
    const r = hit.getRow(), e = colIdx_("estado"), c = colIdx_("comentarioBP");
    const previo = sh.getRange(r, 1, 1, COLS.length).getValues()[0];
    if (String(previo[colIdx_("enviadoPor")]).toLowerCase() !== String(rec.enviadoPor).toLowerCase()) throw new Error("ID ya registrado por otro usuario");
    fila[e] = previo[e] || "Nuevo"; fila[c] = previo[c] || "";
    if (fila[e] === "Devuelto al jefe") fila[e] = "En revisión BP";   // el jefe corrigió y reenvió: vuelve al BP
    fila[colIdx_("comentarioGerencia")] = previo[colIdx_("comentarioGerencia")] || "";
    sh.getRange(r, 1, 1, COLS.length).setValues([fila]);
  } else {
    fila[colIdx_("estado")] = rec.estado || "Nuevo";
    sh.appendRow(fila);
  }
}

function filaARegistro_(f) {
  const rec = { data: {} };
  COLS.forEach((c, i) => {
    const k = c[1], v = f[i];
    if (k === "_dyn") rec.data.dynamic = v ? JSON.parse(v) : {};
    else if (k === "_apr") rec.data.approvals = v ? JSON.parse(v) : [];
    else if (TOP.indexOf(k) >= 0) rec[k] = v;
    else rec.data[k] = v;
  });
  rec.data.emailCliente = rec.enviadoPor;
  return rec;
}

function log_(contexto, detalle) {
  try {
    const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SS_ID"));
    ss.getSheetByName(CONFIG.HOJA_LOG).appendRow([new Date().toISOString(), contexto, String(detalle).slice(0, 500)]);
  } catch (e) { Logger.log(contexto + ": " + detalle); }
}

// ============================================================ RUTEO: DEPARTAMENTO → BP
function prepararRuteo_(ss) {
  const bps = ss.insertSheet("BPs");
  bps.getRange(1, 1, 1, 3).setValues([["Nombre del BP", "Correo", "Cargo"]]).setFontWeight("bold").setBackground("#00195A").setFontColor("#FFFFFF");
  if (CONFIG.BPS_DIRECTORIO.length) bps.getRange(2, 1, CONFIG.BPS_DIRECTORIO.length, 3).setNumberFormat("@").setValues(CONFIG.BPS_DIRECTORIO);
  bps.setColumnWidth(1, 220); bps.setColumnWidth(2, 260); bps.setColumnWidth(3, 200); bps.setFrozenRows(1);

  const sh = ss.insertSheet(CONFIG.HOJA_RUTEO);
  sh.getRange(1, 1, 1, 4).setValues([["Departamento", "Área (* = todas)", "Nombre del BP (elige de la lista)", "Correo del BP (automático)"]])
    .setFontWeight("bold").setBackground("#00195A").setFontColor("#FFFFFF");
  const filas = (CONFIG.RUTEO_INICIAL.length ? CONFIG.RUTEO_INICIAL : CATALOGO.departamentos.map(d => [d, "*", ""])).map(r => [r[0], r[1], r[2] || ""]);
  sh.getRange(2, 1, filas.length, 3).setNumberFormat("@").setValues(filas);
  const N = 200;
  sh.getRange(2, 3, N, 1).setBackground("#FFF4C2").setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInRange(bps.getRange("A2:A30"), true).setAllowInvalid(false).build());
  sh.getRange(2, 4, N, 1).setFormulas(Array.from({ length: N }, (_, i) => ['=IF(C' + (i + 2) + '="","",IFERROR(VLOOKUP(C' + (i + 2) + ',BPs!A:B,2,FALSE),""))']));
  sh.setColumnWidth(1, 380); sh.setColumnWidth(2, 240); sh.setColumnWidth(3, 240); sh.setColumnWidth(4, 260);
  sh.setFrozenRows(1);
  sh.getRange("F1").setValue("La fila más específica gana (Departamento + Área sobre Departamento + *). Para dividir un departamento entre varios BP, agrega filas con el mismo Departamento y el nombre exacto del Área. Sin BP → la solicitud va al coordinador.");
}

function normalizar_(s) {
  return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Devuelve {nombre, correo} del BP que atiende ese departamento (y área), o null. */
function buscarBP_(departamento, area) {
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SS_ID"));
  const filas = ss.getSheetByName(CONFIG.HOJA_RUTEO).getDataRange().getValues().slice(1);
  const d = normalizar_(departamento), a = normalizar_(area);
  let mejor = null;
  filas.forEach(r => {
    if (!r[2] || !r[3] || normalizar_(r[0]) !== d) return;
    const ra = normalizar_(r[1]);
    if (ra === "" || ra === "*") { if (!mejor) mejor = { nombre: String(r[2]).trim(), correo: String(r[3]).trim() }; }
    else if (ra === a) mejor = { nombre: String(r[2]).trim(), correo: String(r[3]).trim() };
  });
  return mejor;
}

function asignar_(rec) {
  const bp = buscarBP_(rec.data.departamento, rec.data.area);
  rec.data.bp = bp ? bp.nombre : "Sin asignar";
  rec.bpCorreo = bp ? bp.correo : "";
  return rec;
}

// ============================================================ CORREOS
/** Quita caracteres de control (conserva saltos de línea y tabulaciones) y recorta espacios. */
function limpiar_(v, max) {
  return String(v == null ? "" : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max || 3000);
}
function unaLinea_(v, max) { return limpiar_(v, max).replace(/\s+/g, " "); }

function h_(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

/** Los correos salen salvo que ENVIAR_CORREOS sea false o exista la propiedad SIN_CORREOS = 1 (interruptor para pruebas, sin redesplegar). */
function enviarCorreos_() { return CONFIG.ENVIAR_CORREOS && PropertiesService.getScriptProperties().getProperty("SIN_CORREOS") !== "1"; }

function notificar_(rec) {
  if (!enviarCorreos_()) return;
  const d = rec.data, sinBP = !rec.bpCorreo;
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SS_ID"));
  const fila = [["Tipo de movimiento", d.movimiento], ["Colaborador", d.colaborador + (d.codigo && d.codigo !== "No aplica" ? " · " + d.codigo : "")],
    ["Puesto actual", d.puestoActual], ["Departamento / Área", [d.departamento, d.area].filter(Boolean).join(" · ")],
    ["Líder solicitante", d.cliente + " · " + d.cargoCliente + " · " + d.emailCliente], ["Presupuesto", d.presupuesto + " · " + d.fuentePresupuesto],
    ["Urgencia / impacto", d.urgencia + " · " + d.impacto], ["Detalle del impacto", d.impactoDetalle],
    ["Origen", rec.origen === "web" ? "App web (correo declarado por el usuario, no verificado)" : "Formulario de Google (correo verificado)"]];
  const tabla = "<table cellpadding='6' style='border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px'>" +
    fila.map(f => "<tr><td style='border-bottom:1px solid #D9E1F5;color:#5B6A8F'><b>" + h_(f[0]) + "</b></td><td style='border-bottom:1px solid #D9E1F5'>" + h_(f[1]) + "</td></tr>").join("") + "</table>";
  const destino = sinBP ? CONFIG.COORDINADOR : rec.bpCorreo;
  try {
    if (destino) MailApp.sendEmail({
      to: destino, replyTo: d.emailCliente || undefined,
      subject: unaLinea_((sinBP ? "[SIN BP ASIGNADO] " : "[Movimiento de talento] ") + d.movimiento + " · " + (d.colaborador || d.area) + " · " + rec.id, 200),
      htmlBody: "<p>" + (sinBP ? "No hay Business Partner configurado para el departamento <b>" + h_(d.departamento) + "</b>. Asigna y reenvía." : "Nueva solicitud para <b>" + h_(rec.data.bp) + "</b>.") +
        "</p>" + tabla + "<p>Revisa y gestiona la solicitud completa en la hoja de entradas: <a href='" + ss.getUrl() + "'>abrir</a> (ID " + h_(rec.id) + ").</p>"
    });
    if (d.emailCliente) MailApp.sendEmail({
      to: d.emailCliente,
      subject: "Recibimos tu solicitud " + rec.id,
      htmlBody: "<p>Tu solicitud de <b>" + h_(d.movimiento) + "</b> fue registrada y se envió a tu Business Partner" + (sinBP ? " (pendiente de asignar)" : ": <b>" + h_(rec.data.bp) + "</b>") + ".</p>" + tabla +
        (rec.editUrl ? "<p>Si necesitas corregirla: <a href='" + h_(rec.editUrl) + "'>editar respuesta</a>.</p>" : "")
    });
  } catch (e) {
    log_("Correo " + rec.id, e);
    if (CONFIG.COORDINADOR) try { MailApp.sendEmail(CONFIG.COORDINADOR, "Falló el envío de correo " + rec.id, String(e)); } catch (_) {}
  }
}

// ============================================================ FORMULARIO → ENTRADAS
function alEnviar(e) {                      // activador: se ejecuta con cada envío del formulario
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const rec = asignar_(aRegistro_(e.response));
    guardarFila_(rec);
    notificar_(rec);
  } catch (err) { log_("alEnviar", err); throw err; }
  finally { lock.releaseLock(); }
}

function aRegistro_(resp) {
  const r = {};
  resp.getItemResponses().forEach(ir => { r[ir.getItem().getTitle()] = ir.getResponse(); });
  const movNombre = r["Tipo de movimiento"];
  const m = CATALOGO.movs.find(x => x.nombre === movNombre);
  if (!m) throw new Error("Tipo de movimiento desconocido: " + movNombre);
  const val = q => (r[q.t] === undefined ? "" : limpiar_(Array.isArray(r[q.t]) ? r[q.t].join(", ") : r[q.t]));
  const pick = lista => { const o = {}; lista.forEach(q => { o[q.id] = val(q); }); return o; };

  const d = Object.assign({}, pick(CATALOGO.comun.solicitud), pick(m.sinMatricula ? CATALOGO.comun.area : CATALOGO.comun.colaborador));
  if (m.sinMatricula) {
    d.codigo = "No aplica"; d.colaborador = m.colaboradorFijo; d.puestoActual = "No aplica";
  } else if (/^\d+$/.test(d.codigo)) {
    d.codigo = ("0000000000" + d.codigo).slice(-10);
  }
  d.movimiento = movNombre;
  Object.assign(d, pick(CATALOGO.comun.presupuesto), pick(CATALOGO.comun.impacto));
  d.tieneAprobacion = val(CATALOGO.comun.tieneAprobacion);
  d.emailCliente = resp.getRespondentEmail() || "";
  d.solicitudConcreta = "";                 // se genera después, con las entradas exportadas

  d.dynamic = {};
  m.secciones.forEach(s => s.preguntas.forEach(q => { if (r[q.t] !== undefined) d.dynamic[q.id] = val(q); }));

  d.approvals = [];
  for (let n = 1; n <= CONFIG.APROBACIONES_MAX; n++) {
    const a = {};
    let hay = false;
    CATALOGO.comun.aprobacion.forEach(q => {
      const v = r["Aprobación " + n + " · " + q.t];
      if (v !== undefined) hay = true;
      a[q.id] = v === undefined ? "" : String(v);
    });
    if (hay) { if (a.type === SIN_EVIDENCIA) a.type = ""; d.approvals.push(a); }
  }
  const ts = resp.getTimestamp();
  return {
    id: "ENT-" + String(resp.getId()).slice(-14),
    enviadoEl: ts.toISOString(), enviadoPor: d.emailCliente, origen: "formulario",
    periodo: (d.fechaSolicitud || "").slice(0, 7), data: d, editUrl: resp.getEditResponseUrl()
  };
}

// ============================================================ APP WEB → ENTRADAS (receptor)
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doPost(e) {
  const consulta = e && e.postData && e.postData.length <= CONFIG.MAX_BYTES ? consultaMaestro_(e) : null;
  if (consulta) return consulta;
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    if (!e || !e.postData || e.postData.length > CONFIG.MAX_BYTES) return json_({ ok: false, error: "Solicitud inválida o demasiado grande" });
    const body = JSON.parse(e.postData.contents);
    if (CONFIG.TOKEN && body.token !== CONFIG.TOKEN) return json_({ ok: false, error: "No autorizado" });
    const rec = desdeWeb_(body.rec);          // valida correo, departamento, tipos y longitudes
    limitar_(rec.enviadoPor);                 // anti-spam
    guardarFila_(rec);
    notificar_(rec);
    return json_({ ok: true, id: rec.id, bp: rec.bpCorreo ? rec.data.bp : null });
  } catch (err) {
    log_("doPost", err);
    return json_({ ok: false, error: String(err).replace(/^Error: /, "") });
  } finally { lock.releaseLock(); }
}

/** Máximo de envíos por correo y hora, y de envíos totales por día. Lanza error al superarlos. */
function limitar_(email) {
  const ahora = new Date();
  const cache = CacheService.getScriptCache();
  const k = "rl:" + email + ":" + Utilities.formatDate(ahora, "UTC", "yyyyMMddHH");
  const n = Number(cache.get(k) || 0) + 1;
  if (n > CONFIG.MAX_POR_CORREO_HORA) throw new Error("Demasiados envíos desde este correo. Intenta de nuevo en una hora.");
  const props = PropertiesService.getScriptProperties();
  const dk = "g:" + Utilities.formatDate(ahora, "UTC", "yyyyMMdd");
  const g = Number(props.getProperty(dk) || 0) + 1;
  if (g > CONFIG.MAX_GLOBAL_DIA) throw new Error("Se alcanzó el límite diario de envíos. Intenta mañana o usa el formulario.");
  cache.put(k, String(n), 3600);
  props.setProperty(dk, String(g));
  const ayer = "g:" + Utilities.formatDate(new Date(ahora.getTime() - 86400000), "UTC", "yyyyMMdd");
  props.deleteProperty(ayer);
}

/** Valida y normaliza un registro enviado por la app web. */
function desdeWeb_(w) {
  const src = w && w.data;
  if (!src) throw new Error("Registro vacío");
  const m = CATALOGO.movs.find(x => x.nombre === src.movimiento);
  if (!m) throw new Error("Tipo de movimiento inválido");

  const email = unaLinea_(src.emailCliente, 120).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Correo inválido");
  if (CONFIG.DOMINIOS_PERMITIDOS.length && CONFIG.DOMINIOS_PERMITIDOS.indexOf(email.split("@")[1]) < 0) throw new Error("Usa tu correo institucional");
  if (CATALOGO.departamentos.indexOf(src.departamento) < 0) throw new Error("Departamento inválido");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(src.fechaSolicitud || ""))) throw new Error("Fecha de solicitud inválida");

  const d = { dynamic: {}, approvals: [] };
  ["cliente", "cargoCliente", "area", "seccion", "colaborador", "puestoActual", "validaPresupuesto"].forEach(k => { d[k] = unaLinea_(src[k], 200); });
  ["tieneAprobacion", "presupuesto", "fuentePresupuesto", "urgencia", "impacto", "consecuencia"].forEach(k => { d[k] = unaLinea_(src[k], 80); });
  d.fechaSolicitud = src.fechaSolicitud; d.emailCliente = email; d.departamento = src.departamento;
  d.codigo = unaLinea_(src.codigo, 20);
  d.montoPresupuesto = String(Number(src.montoPresupuesto) >= 0 ? Number(src.montoPresupuesto) : "");
  d.impactoDetalle = limpiar_(src.impactoDetalle, 1000);
  d.solicitudConcreta = limpiar_(src.solicitudConcreta, 3000);
  const ev = w.evaluation || {}, lista = x => (Array.isArray(x) ? x : []).slice(0, 10).map(t => unaLinea_(t, 250)).join(" | ");
  d.puntaje = ev.score == null ? "" : String(Math.max(0, Math.min(100, Math.round(Number(ev.score) || 0))));
  d.clasificacion = unaLinea_(ev.label, 80); d.fortalezas = lista(ev.strengths); d.alertas = lista(ev.alerts); d.recomendacion = limpiar_(ev.recommendation, 500);
  d.movimiento = m.nombre;
  if (m.sinMatricula) { d.codigo = "No aplica"; d.colaborador = m.colaboradorFijo; d.puestoActual = "No aplica"; }
  else if (/^\d+$/.test(d.codigo)) d.codigo = ("0000000000" + d.codigo).slice(-10);
  else throw new Error("Matrícula inválida");
  if (!d.cliente) throw new Error("Faltan datos del líder");

  const opciones = {};
  m.secciones.forEach(s => s.preguntas.forEach(q => { opciones[q.id] = q; }));
  Object.keys(src.dynamic || {}).forEach(k => {
    const q = opciones[k]; if (!q) return;
    const v = limpiar_(src.dynamic[k], q.max || 300);
    if (q.tipo === "select" && v && q.opc.indexOf(v) < 0) throw new Error("Valor inválido en " + k);
    d.dynamic[k] = v;
  });
  (src.approvals || []).slice(0, CONFIG.APROBACIONES_MAX).forEach(a => d.approvals.push({
    level: unaLinea_(a.level, 60), name: unaLinea_(a.name, 120), role: unaLinea_(a.role, 120), date: unaLinea_(a.date, 20),
    evidence: unaLinea_(a.evidence, 10), type: unaLinea_(a.type, 40) }));
  const id = unaLinea_(w.id, 40).replace(/[^A-Za-z0-9_-]/g, "");
  const rec = {
    id: id || ("WEB-" + Date.now()), enviadoEl: new Date().toISOString(), enviadoPor: email, origen: "web",
    periodo: d.fechaSolicitud.slice(0, 7), data: d, editUrl: ""
  };
  return asignar_(rec);
}

// ============================================================ ADMINISTRACIÓN
/** Da acceso de edición a la hoja a todos los BP listados en «Ruteo». */
function compartirConBPs() {
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SS_ID"));
  const correos = {};
  ss.getSheetByName(CONFIG.HOJA_RUTEO).getDataRange().getValues().slice(1).forEach(r => { if (r[3]) correos[String(r[3]).trim().toLowerCase()] = true; });
  if (CONFIG.COORDINADOR) correos[CONFIG.COORDINADOR.toLowerCase()] = true;
  const lista = Object.keys(correos);
  if (lista.length) ss.addEditors(lista);
  Logger.log("Compartido con: " + lista.join(", "));
}

/** Crea una pestaña por BP con sus solicitudes (se actualiza sola). Ejecútala después de llenar «Ruteo». */
function crearVistasPorBP() {
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SS_ID"));
  const nombres = {};
  ss.getSheetByName(CONFIG.HOJA_RUTEO).getDataRange().getValues().slice(1).forEach(r => { if (r[2]) nombres[String(r[2]).trim()] = true; });
  const col = String.fromCharCode(65 + colIdx_("bp"));
  const ultima = columna_(COLS.length);
  Object.keys(nombres).forEach(n => {
    const nombre = ("BP · " + n).slice(0, 90);
    let sh = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
    sh.clear();
    sh.getRange("A1").setFormula("=IFERROR(QUERY(" + CONFIG.HOJA_ENTRADAS + "!A:" + ultima + ",\"select * where " + col + " = '" + n.replace(/'/g, "''") + "'\",1),\"Sin solicitudes\")");
  });
}
function columna_(n) { let s = ""; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; }

// ============================================================ EXTRACCIÓN
/** Genera entradas_<fecha>.json y .csv en tu Drive. periodo: "2026-10" o vacío para todas. Lee la hoja «Entradas» (formulario y web). */
function exportarEntradas(periodo) {
  const filas = hojaEntradas_().getDataRange().getValues().slice(1).filter(f => f[0]);
  const recs = filas.map(filaARegistro_).filter(r => !periodo || r.periodo === periodo);
  const it = DriveApp.getFoldersByName(CONFIG.CARPETA_EXPORT);
  const carpeta = it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.CARPETA_EXPORT);
  const sello = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HHmm");
  const salida = recs.map(r => ({ id: r.id, enviadoEl: r.enviadoEl, enviadoPor: r.enviadoPor, origen: r.origen, periodo: r.periodo,
    bpAsignado: r.data.bp, bpCorreo: r.bpCorreo, estado: r.estado, comentarioBP: r.comentarioBP, data: r.data }));
  const json = carpeta.createFile("entradas_" + sello + ".json", JSON.stringify(salida, null, 2), "application/json");

  const esc = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  const claves = COLS.map(c => c[1]).filter(k => k !== "editUrl");
  const csvRows = [COLS.filter(c => c[1] !== "editUrl").map(c => c[0])].concat(recs.map(r => claves.map(k => valorCol_(r, k))));
  const csv = carpeta.createFile("entradas_" + sello + ".csv", "﻿" + csvRows.map(f => f.map(esc).join(",")).join("\r\n"), "text/csv");
  Logger.log(recs.length + " entradas exportadas.\nJSON: " + json.getUrl() + "\nCSV: " + csv.getUrl());
  return { total: recs.length, json: json.getUrl(), csv: csv.getUrl() };
}

// ============================================================ PANEL WEB (jefes de área · BP · Gerencia)
// Se sirve desde la misma implementación web (doGet + Panel.html). La identidad sale de la cuenta Google, no de un campo de texto.
function doGet() {
  return HtmlService.createHtmlOutputFromFile("Panel").setTitle("Solicitudes de Talento · USIL")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

function quien_(token) {
  if (token) {
    const s = CacheService.getScriptCache().get("ses:" + token);
    if (!s) throw new Error("Tu sesión venció. Vuelve a entrar.");
    return JSON.parse(s);
  }
  const email = String(Session.getActiveUser().getEmail() || "").toLowerCase();
  if (!email) throw new Error("Inicia sesión en Google con tu cuenta institucional y recarga la página.");
  if (CONFIG.DOMINIOS_PERMITIDOS.length && CONFIG.DOMINIOS_PERMITIDOS.indexOf(email.split("@")[1]) < 0) throw new Error("Estás con la cuenta " + email + ". Abre el panel con tu cuenta institucional (@usil.edu.pe).");
  const roles = rolesDe_(email), vistas = ["jefe"];
  if (roles.bp) vistas.push("bp");
  if (roles.gerencia) vistas.push("gerencia");
  return { email, vistas };
}
/** Roles de un correo (según BPs, GERENTES) y, si se indica, la identidad de Google. */
function rolesDe_(email) {
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SS_ID"));
  const bps = {};
  CONFIG.BPS_DIRECTORIO.forEach(b => { bps[b[1].toLowerCase()] = 1; });
  const hoja = ss.getSheetByName("BPs");
  if (hoja) hoja.getDataRange().getValues().slice(1).forEach(r => { if (r[1]) bps[String(r[1]).trim().toLowerCase()] = 1; });
  return { bp: !!bps[email], gerencia: CONFIG.GERENTES.some(g => g.toLowerCase() === email) };
}

/** Entrada con clave (para quien no tiene sesión de Google institucional). Las claves viven en Propiedades de la secuencia de comandos:
 *  CLAVE_BP (HRBP) y CLAVE_GERENCIA (Gerencia). Devuelve un token de sesión de 6 horas. */
function panelEntrar(email, clave) {
  email = unaLinea_(email, 120).toLowerCase();
  const cache = CacheService.getScriptCache(), props = PropertiesService.getScriptProperties();
  const k = "in:" + email, n = Number(cache.get(k) || 0);
  if (n >= 5) throw new Error("Demasiados intentos. Espera 15 minutos.");
  const roles = rolesDe_(email), vistas = [];
  const ok = (rol, nombre) => { const c = props.getProperty(nombre); return roles[rol] && c && String(clave) === c; };
  if (ok("bp", "CLAVE_BP")) vistas.push("bp");
  if (ok("gerencia", "CLAVE_GERENCIA")) vistas.push("gerencia");
  if (!vistas.length) { cache.put(k, String(n + 1), 900); throw new Error("Correo o clave incorrectos."); }
  cache.remove(k);
  const token = Utilities.getUuid() + Utilities.getUuid();
  cache.put("ses:" + token, JSON.stringify({ email, vistas }), 21600);
  return { token, email, vistas };
}

/** Quién eres: por token de clave o, si no hay, por la cuenta de Google. */
function panelQuien(token) { return quien_(token); }


function filasVista_(q, vista) {
  if (q.vistas.indexOf(vista) < 0) throw new Error("Sin acceso a esta vista");
  const clave = vista === "jefe" ? colIdx_("enviadoPor") : colIdx_("bpCorreo");
  return hojaEntradas_().getDataRange().getValues().slice(1)
    .filter(f => f[0] && (vista === "gerencia" ? VISIBLE_GER.indexOf(f[colIdx_("estado")]) >= 0 : String(f[clave]).toLowerCase() === q.email));
}

function panelDatos(vista, token) {
  const q = quien_(token);
  const filas = filasVista_(q, vista).map(f => {
    const o = {};
    COLS.forEach((c, i) => { if (["_dyn", "_apr", "editUrl"].indexOf(c[1]) < 0) o[c[1]] = f[i]; });
    return o;
  });
  return { email: q.email, vistas: q.vistas, vista, filas, estados: vista === "bp" ? ESTADOS_BP : ESTADOS_GER, editables: vista === "bp" ? EDITABLE_BP : vista === "gerencia" ? EDITABLE_GER : [] };
}

/** Respuestas del levantamiento como pares [texto de la pregunta, respuesta]. */
function levantamientoDe_(rec) {
  const m = CATALOGO.movs.find(x => x.nombre === rec.data.movimiento), titulo = {};
  if (m) m.secciones.forEach(s => s.preguntas.forEach(p => { titulo[p.id] = p.t; }));
  return Object.keys(rec.data.dynamic).filter(k => rec.data.dynamic[k] !== "").map(k => [titulo[k] || k, rec.data.dynamic[k]]);
}

/** Todos los registros de la vista (BP o Gerencia) con el levantamiento y las aprobaciones, para armar el Excel en el panel. */
function panelExportar(vista, token) {
  if (vista !== "bp" && vista !== "gerencia") throw new Error("Solo BP y Gerencia pueden descargar el Excel");
  return filasVista_(quien_(token), vista).map(f => {
    const rec = filaARegistro_(f), o = {};
    COLS.forEach((c, i) => { if (["_dyn", "_apr", "editUrl"].indexOf(c[1]) < 0) o[c[1]] = f[i]; });
    o.levantamiento = levantamientoDe_(rec); o.aprobaciones = rec.data.approvals;
    return o;
  });
}

/** Detalle de una solicitud (levantamiento con los títulos de las preguntas y aprobaciones). Solo si la vista la puede ver. */
function panelDetalle(id, vista, token) {
  const f = filasVista_(quien_(token), vista).find(x => x[0] === id);
  if (!f) throw new Error("Solicitud no disponible");
  const rec = filaARegistro_(f);
  return {
    puntaje: rec.data.puntaje, clasificacion: rec.data.clasificacion, fortalezas: rec.data.fortalezas, alertas: rec.data.alertas, recomendacion: rec.data.recomendacion,
    sustento: rec.data.solicitudConcreta, impacto: rec.data.impactoDetalle, editUrl: rec.editUrl,
    levantamiento: levantamientoDe_(rec),
    aprobaciones: rec.data.approvals
  };
}

/** BP: cambia estado/comentario de SUS solicitudes. Gerencia: de cualquiera, con decisión final. */
function panelActualizar(id, vista, estado, comentario, token) {
  if (vista !== "bp" && vista !== "gerencia") throw new Error("Vista no válida");
  const q = quien_(token);
  if ((vista === "bp" ? ESTADOS_BP : ESTADOS_GER).indexOf(estado) < 0) throw new Error("Estado no permitido");
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const fila = filasVista_(q, vista).find(f => f[0] === id);
    if (!fila) throw new Error("Solicitud no disponible");
    if ((vista === "bp" ? EDITABLE_BP : EDITABLE_GER).indexOf(fila[colIdx_("estado")] || "Nuevo") < 0) throw new Error("Esta solicitud ya no está en tu etapa");
    const sh = hojaEntradas_();
    const hit = sh.createTextFinder(id).matchEntireCell(true).findNext();
    if (!hit || hit.getColumn() !== 1) throw new Error("Solicitud no encontrada");
    const r = hit.getRow();
    sh.getRange(r, colIdx_("estado") + 1).setValue(estado);
    sh.getRange(r, colIdx_(vista === "bp" ? "comentarioBP" : "comentarioGerencia") + 1).setValue(limpiar_(comentario, 1000));
    avisarCambio_(filaARegistro_(fila), estado, limpiar_(comentario, 1000));
    return { ok: true };
  } finally { lock.releaseLock(); }
}

/** Correo en cada paso del flujo: devuelto → jefe; enviado a Gerencia → gerentes; decisión → jefe y BP; devuelto por Gerencia → BP. */
function avisarCambio_(rec, estado, comentario) {
  if (!enviarCorreos_()) return;
  const d = rec.data, tema = unaLinea_(d.movimiento + " · " + (d.colaborador || d.area) + " · " + rec.id, 160);
  const destinos = { "Devuelto al jefe": [rec.enviadoPor], "Enviado a Gerencia": CONFIG.GERENTES, "Aprobado": [rec.enviadoPor, rec.bpCorreo], "Rechazado": [rec.enviadoPor, rec.bpCorreo], "En revisión BP": [rec.bpCorreo] }[estado] || [];
  const to = destinos.filter(Boolean).join(",");
  if (!to) return;
  const corregir = estado === "Devuelto al jefe" && rec.editUrl ? "<p><a href='" + h_(rec.editUrl) + "'>Corregir y reenviar</a></p>" : "";
  try {
    MailApp.sendEmail({ to, subject: "[" + estado + "] " + tema,
      htmlBody: "<p>Estado: <b>" + h_(estado) + "</b> · BP: " + h_(d.bp) + "</p>" + (comentario ? "<p>Comentario: " + h_(comentario) + "</p>" : "") + corregir + "<p>Revísala en el panel de Solicitudes de Talento.</p>" });
  } catch (e) { log_("Aviso " + rec.id, e); }
}

/** Si agregas columnas nuevas a COLS después de crear la hoja: ejecútala una vez para escribir los encabezados faltantes (no borra datos). */
function actualizarEncabezados() {
  const sh = hojaEntradas_();
  sh.getRange(1, 1, 1, COLS.length).setValues([COLS.map(c => c[0])]).setFontWeight("bold").setBackground("#00195A").setFontColor("#FFFFFF");
  sh.getRange(2, 1, sh.getMaxRows() - 1, COLS.length).setNumberFormat("@");
  sh.getRange(2, colIdx_("estado") + 1, 2000, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(ESTADOS, true).build());   // lista de estados del flujo
}

// ============================================================ MAESTRO (autocompletado de la solicitud)
// Hoja «Maestro» dentro de la hoja de Entradas, con SOLO estas 8 columnas (se genera con tools/preparar-maestro.py). Nunca va al repositorio.
const MAESTRO_COLS = ["Matrícula", "Nombre completo", "Puesto", "Situación", "Departamento", "Área", "Sección", "Email trabajo"];

/** Responde las consultas {accion:"maestro"} de la app web. Devuelve null si el POST es otra cosa. Una persona por consulta. */
function consultaMaestro_(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (_) { return null; }
  if (!body || body.accion !== "maestro") return null;
  try {
    if (CONFIG.TOKEN && body.token !== CONFIG.TOKEN) throw new Error("No autorizado");
    const email = unaLinea_(body.email, 120).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || (CONFIG.DOMINIOS_PERMITIDOS.length && CONFIG.DOMINIOS_PERMITIDOS.indexOf(email.split("@")[1]) < 0)) throw new Error("Usa tu correo institucional");
    limitarConsulta_(email);
    const hoja = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SS_ID")).getSheetByName("Maestro");
    if (!hoja) return json_({ ok: true, item: null });
    let fila = null;
    if (body.aleatorio) fila = filaAleatoriaMaestro_(hoja, body.departamento);          // solo para el modo demo
    else if (body.lider) fila = buscarFilaMaestro_(hoja, 8, email);
    else {
      const c = String(body.codigo || "");
      if (!/^\d{4,10}$/.test(c)) throw new Error("Matrícula inválida");
      fila = buscarFilaMaestro_(hoja, 1, ("0000000000" + c).slice(-10));
    }
    const item = fila ? { nombre: fila[1], puesto: fila[2], situacion: fila[3], departamento: fila[4], area: fila[5], seccion: fila[6] } : null;
    if (item && body.aleatorio) item.codigo = fila[0];
    return json_({ ok: true, item });
  } catch (err) { return json_({ ok: false, error: String(err).replace(/^Error: /, "") }); }
}

/** Una persona ACTIVA con departamento, área y sección completos, al azar (modo demo). */
function filaAleatoriaMaestro_(hoja, departamento) {
  const todas = hoja.getDataRange().getValues().slice(1).filter(f => normalizar_(f[3]) === "activo");
  const dep = normalizar_(departamento), deDep = dep ? todas.filter(f => normalizar_(f[4]) === dep) : todas;
  const completas = deDep.filter(f => f[4] && f[5] && f[6]);
  const v = completas.length ? completas : deDep.length ? deDep : todas;
  return v.length ? v[Math.floor(Math.random() * v.length)] : null;
}

function buscarFilaMaestro_(hoja, col, valor) {
  const hit = hoja.createTextFinder(valor).matchEntireCell(true).matchCase(false).findNext();
  return hit && hit.getColumn() === col ? hoja.getRange(hit.getRow(), 1, 1, MAESTRO_COLS.length).getValues()[0] : null;
}

/** Límite de consultas al maestro por correo y hora, y por día en total (frena el barrido de matrículas). */
function limitarConsulta_(email) {
  const ahora = new Date(), cache = CacheService.getScriptCache(), props = PropertiesService.getScriptProperties();
  const k = "mq:" + email + ":" + Utilities.formatDate(ahora, "UTC", "yyyyMMddHH");
  const n = Number(cache.get(k) || 0) + 1;
  if (n > CONFIG.MAX_CONSULTAS_HORA) throw new Error("Demasiadas consultas. Completa los datos manualmente o intenta en una hora.");
  const dk = "mqd:" + Utilities.formatDate(ahora, "UTC", "yyyyMMdd");
  const g = Number(props.getProperty(dk) || 0) + 1;
  if (g > CONFIG.MAX_CONSULTAS_DIA) throw new Error("Se alcanzó el límite diario de consultas. Completa los datos manualmente.");
  cache.put(k, String(n), 3600);
  props.setProperty(dk, String(g));
}

/** Asignación de PRUEBA en «Ruteo»: reparte los departamentos entre los BP de BPS_DIRECTORIO (4 por BP) y reescribe la fórmula del correo.
 *  Ejecútala una vez para probar. Para producción, reemplaza la columna C por el BP real de cada departamento. */
function cargarRuteoDePrueba() {
  const sh = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SS_ID")).getSheetByName(CONFIG.HOJA_RUTEO);
  const n = CATALOGO.departamentos.length, bps = CONFIG.BPS_DIRECTORIO.map(b => b[0]), por = Math.ceil(n / bps.length);
  sh.getRange(2, 1, n, 1).setValues(CATALOGO.departamentos.map(d => [d]));
  sh.getRange(2, 2, n, 1).setValues(CATALOGO.departamentos.map(() => ["*"]));
  sh.getRange(2, 3, n, 1).setValues(CATALOGO.departamentos.map((d, i) => [bps[Math.floor(i / por) % bps.length]]));
  sh.getRange(2, 4, 200, 1).setFormulas(Array.from({ length: 200 }, (_, i) => ['=IF(C' + (i + 2) + '="","",IFERROR(VLOOKUP(C' + (i + 2) + ',BPs!A:B,2,FALSE),""))']));
  Logger.log("Ruteo de prueba cargado: " + n + " departamentos entre " + bps.length + " BP.");
}

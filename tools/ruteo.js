// Ruteo de PRUEBA: departamento → Business Partner (4 por BP). Para producción, cambia el BP de cada departamento y vuelve a ejecutar cargar-datos.js.
const BP = {
  fatima: { nombre: "Fátima Salazar", correo: "msalazar@usil.edu.pe" },
  melissa: { nombre: "Melissa Higa", correo: "mhiga@usil.edu.pe" },
  lesley: { nombre: "Lesley Reyes", correo: "lreyes@usil.edu.pe" },
  claudia: { nombre: "Claudia Muñoz", correo: "cmunozse@usil.edu.pe" }
};
module.exports = {
  "DIRECCION GENERAL DE SEDES DESCENTRALIZADAS": BP.fatima, "DIRECCION GENERAL DEL CSIR": BP.fatima, "ESCUELA DE POSGRADO": BP.fatima, "GERENCIA DE ADMINISTRACION Y SEGURIDAD": BP.fatima,
  "GERENCIA DE PROYECTOS - SEDE PERU": BP.melissa, "GERENCIA GENERAL": BP.melissa, "GERENCIA LEGAL": BP.melissa, "GERENCIA SENIOR DE FINANZAS": BP.melissa,
  "PRESIDENCIA EJECUTIVA": BP.lesley, "RECTORADO": BP.lesley, "VICEPRESIDENCIA DE ASUNTOS CORPORATIVOS": BP.lesley, "VICEPRESIDENCIA DE COMUNICACIONES E INNOVACION DIG": BP.lesley,
  "GERENCIA DE TALENTO Y CULTURA": BP.claudia, "VICEPRESIDENCIA SENIOR": BP.claudia, "VICERRECTORADO ACADEMICO": BP.claudia, "VICERRECTORADO DE INVESTIGACION": BP.claudia
};

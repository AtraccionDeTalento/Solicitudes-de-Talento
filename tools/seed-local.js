// Carga datos de PRUEBA (inventados) en los emuladores de Firebase. Uso: npm run seed:local (con npm run emu abierto).
Object.assign(process.env, { FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099", GCLOUD_PROJECT: "demo-local", DATOS_PRUEBA: "1" });
process.argv.push("--borrar-solicitudes");   // en los emuladores cada carga parte sin solicitudes viejas
if (process.argv.includes("--real")) { process.argv = process.argv.filter(x => x !== "--real"); process.argv.push(require("path").join(__dirname, "..", "..", "Maestro_recortado.csv")); }   // con tu maestro real (solo en el emulador, en memoria)
require("./cargar-datos.js");

// Carga datos de PRUEBA (inventados) en los emuladores de Firebase. Uso: npm run seed:local (con npm run emu abierto).
Object.assign(process.env, { FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099", GCLOUD_PROJECT: "demo-local", DATOS_PRUEBA: "1" });
require("./cargar-datos.js");

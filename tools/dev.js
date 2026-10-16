// Arranca todo para probar en local: emuladores + datos (maestro real y jefes con DNI) + app. Uso: npm run dev  →  http://localhost:5000/
// Los emuladores pierden los datos al cerrarse; por eso los jefes con DNI se vuelven a cargar en cada arranque.
const { spawn } = require("child_process"), net = require("net"), path = require("path"), raiz = path.join(__dirname, "..");
const correr = (args, opts) => spawn(process.execPath, args, { cwd: raiz, stdio: "inherit", ...opts });
const abierto = p => new Promise(ok => { const s = net.connect(p, "127.0.0.1"); s.on("connect", () => { s.destroy(); ok(true); }); s.on("error", () => ok(false)); });
(async () => {
  const emu = correr(["node_modules/firebase-tools/lib/bin/firebase.js", "emulators:start", "--only", "auth,firestore", "--project", "demo-local"], { stdio: "ignore" });
  process.on("exit", () => emu.kill());
  while (!(await abierto(8080) && await abierto(9099))) await new Promise(r => setTimeout(r, 1500));
  await new Promise(r => correr(["tools/seed-local.js", "--real", "--jefes=tools/jefes-dni.csv"]).on("exit", r));
  if (require("fs").existsSync(path.join(__dirname, "dps.local.json"))) await new Promise(r => correr(["tools/cargar-dps.js", "--emu"]).on("exit", r));   // catálogo de descriptivos de puesto
  correr(["tools/serve.js"]);
})();

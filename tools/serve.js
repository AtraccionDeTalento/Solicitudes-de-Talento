// Servidor local de la app (solo para probar): sirve únicamente los archivos del sitio y abre la CSP a los emuladores.
// Uso: npm run serve  →  http://localhost:5000/
const http = require("http"), fs = require("fs"), path = require("path"), raiz = path.join(__dirname, "..");
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".jpg": "image/jpeg", ".png": "image/png", ".mp4": "video/mp4" };
const SITIO = /^\/(index\.html|panel\.html|app\.js|panel\.js|firebase\.js|fb-init\.js|redactor\.mjs|tablero\.mjs|assets\/[\w.-]+)?$/;
http.createServer((req, res) => {
  const url = new URL(req.url, "http://x"), p = url.pathname === "/" ? "/index.html" : url.pathname;
  if (!SITIO.test(url.pathname)) { res.writeHead(404); return res.end("No encontrado"); }
  fs.readFile(path.join(raiz, p), (err, buf) => {
    if (err) { res.writeHead(404); return res.end("No encontrado"); }
    if (p.endsWith(".html")) buf = buf.toString().replace("connect-src 'self'", "connect-src 'self' http://127.0.0.1:8080 http://127.0.0.1:9099");
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(p)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(buf);
  });
}).listen(5000, "127.0.0.1", () => console.log("App local: http://localhost:5000/"));

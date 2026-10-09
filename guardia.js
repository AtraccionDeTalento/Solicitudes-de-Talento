// Freno contra navegación automatizada (bots, Selenium, Puppeteer, Playwright). Es un DISUASIVO: lo evita quien usa herramientas de scraping sin cuidado,
// pero NO sustituye la seguridad real, que está en el servidor (reglas de Firestore, App Check, cuentas verificadas). En localhost no actúa, para poder probar.
(function () {
  if (["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) return;
  const ua = navigator.userAgent || "", d = document.documentElement;
  const rastros = ["callPhantom", "_phantom", "__nightmare", "_selenium", "__selenium_unwrapped", "__webdriver_evaluate", "__driver_evaluate", "domAutomation", "domAutomationController"];
  const auto = navigator.webdriver === true || /HeadlessChrome|PhantomJS|Puppeteer|Playwright|Selenium|CasperJS/i.test(ua) ||
    rastros.some(k => k in window) || ["webdriver", "selenium", "driver"].some(a => d.getAttribute(a) !== null) ||
    Object.keys(window).some(k => /^cdc_[a-z0-9]{20,}/i.test(k));
  if (!auto) return;
  try { sessionStorage.clear(); localStorage.clear(); } catch (e) { /* sin acceso a almacenamiento */ }
  document.open(); document.write('<!doctype html><meta charset="utf-8"><title>Acceso no permitido</title><body style="font:16px Arial,sans-serif;padding:48px;color:#14213D"><h2>Acceso no permitido</h2><p>Se detectó un acceso automatizado. Si eres una persona, abre esta página en un navegador normal.</p></body>'); document.close();
  throw new Error("acceso automatizado");
})();

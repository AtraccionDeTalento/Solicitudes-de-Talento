// Carga firebase.js y avisa a app.js (que espera window.FB).
import * as FB from "./firebase.js";window.FB=FB;dispatchEvent(new Event("fb"))

"""Saca del Maestro los jefes de área con correo @usil.edu.pe y su documento (la clave inicial de su cuenta).
Uso:  python tools/preparar-jefes.py "Maestro BPs.xlsx" tools/jefes-dni.csv
El CSV resultante contiene datos personales: queda fuera del repositorio (.gitignore) y solo lo lee tools/cargar-datos.js --jefes."""
import csv, sys, unicodedata
import openpyxl

def norm(s):
    return unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower().strip()

LIDERAZGO = ("jefe", "gerente", "subgerente", "director", "subdirector", "coordinador", "decano", "vicerrector", "rector", "vicepresidente", "presidente", "head", "lider")
origen, destino = sys.argv[1], sys.argv[2]
ws = openpyxl.load_workbook(origen, data_only=True).worksheets[0]
filas = ws.iter_rows(values_only=True)
cab = next(f for f in filas if sum(1 for c in f if c not in (None, "")) > 50)
idx = {}
for i, c in enumerate(cab):
    idx.setdefault(norm(c), i)
col = lambda *a: next(idx[norm(x)] for x in a if norm(x) in idx)
c = dict(doc=col("Numero Documento"), mail=col("Email Trabajo"), puesto=col("Nombre Puesto"), nom=col("Nombre"), ap=col("Apellido Paterno"), sit=col("Situacion Trabajador"))
t = lambda f, k: str(f[c[k]]).strip() if f[c[k]] not in (None, "") else ""
vistos, n = set(), 0
with open(destino, "w", newline="", encoding="utf-8") as out:
    w = csv.writer(out); w.writerow(["email", "documento", "nombre", "puesto"])
    for f in filas:
        mail, doc, puesto = t(f, "mail").lower(), "".join(ch for ch in t(f, "doc") if ch.isalnum()), t(f, "puesto")
        if not mail.endswith("@usil.edu.pe") or len(doc) < 8 or mail in vistos: continue
        if not any(k in norm(puesto) for k in LIDERAZGO): continue
        vistos.add(mail); w.writerow([mail, doc, (t(f, "nom") + " " + t(f, "ap")).strip(), puesto]); n += 1
print(n, "jefes escritos en", destino)

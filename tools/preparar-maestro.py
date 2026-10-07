"""Recorta el Maestro de personal a las 8 columnas que usa la solicitud (sin DNI, direcciones ni datos de salud).
Uso:  python tools/preparar-maestro.py "Maestro BPs.xlsx" Maestro_recortado.csv
El CSV resultante contiene datos personales: NO subirlo al repositorio (.gitignore ya lo excluye); se importa a la pestaña «Maestro» de la hoja de Entradas."""
import csv, sys, unicodedata
import openpyxl

def norm(s):
    return unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower().strip()

origen, destino = sys.argv[1], sys.argv[2]
ws = openpyxl.load_workbook(origen, data_only=True).worksheets[0]
filas = ws.iter_rows(values_only=True)
cab = next(f for f in filas if sum(1 for c in f if c not in (None, "")) > 50)   # fila de encabezados
idx = {}
for i, c in enumerate(cab):
    idx.setdefault(norm(c), i)

def col(*alias):
    for a in alias:
        if norm(a) in idx:
            return idx[norm(a)]
    raise SystemExit("No se encontró la columna: " + " / ".join(alias))

c = dict(cod=col("Matricula"), ap=col("Apellido Paterno"), am=col("Apellido Materno"), nom=col("Nombre"), puesto=col("Nombre Puesto"),
         sit=col("Situacion Trabajador"), dep=col("Nombre Departamento"), area=col("Nombre Area"), sec=col("Nombre Seccion"), mail=col("Email Trabajo"))
t = lambda f, k: str(f[c[k]]).strip() if f[c[k]] not in (None, "") else ""
n = 0
with open(destino, "w", newline="", encoding="utf-8-sig") as out:
    w = csv.writer(out)
    w.writerow(["Matrícula", "Nombre completo", "Puesto", "Situación", "Departamento", "Área", "Sección", "Email trabajo"])
    for f in filas:
        cod = "".join(ch for ch in t(f, "cod") if ch.isdigit())
        if not cod:
            continue
        nombre = " ".join(x for x in (t(f, "nom"), t(f, "ap"), t(f, "am")) if x)
        w.writerow([cod.zfill(10), nombre, t(f, "puesto"), t(f, "sit"), t(f, "dep"), t(f, "area"), t(f, "sec"), t(f, "mail").lower()])
        n += 1
print(n, "personas escritas en", destino)

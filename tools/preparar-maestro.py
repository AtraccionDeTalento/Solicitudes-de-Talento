"""Recorta el Maestro de personal a las 8 columnas que usa la solicitud (7 de datos del puesto + el DNI, que solo sirve para crear las cuentas de acceso;
sin direcciones, correos ni datos de salud).
Uso:  python tools/preparar-maestro.py "Maestro BPs.xlsx" Maestro_recortado.csv
El CSV resultante contiene datos personales: NO subirlo al repositorio (.gitignore ya lo excluye); se carga con tools/cargar-datos.js y después hay que BORRARLO (contiene DNI)."""
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
    posibles = [k for k in idx if "doc" in k or "dni" in k]
    raise SystemExit("No se encontró la columna: " + " / ".join(alias) + (" (columnas parecidas: " + ", ".join(posibles) + ")" if posibles else ""))

c = dict(cod=col("Matricula"), ap=col("Apellido Paterno"), am=col("Apellido Materno"), nom=col("Nombre"), puesto=col("Nombre Puesto"),
         sit=col("Situacion Trabajador"), dep=col("Nombre Departamento"), area=col("Nombre Area"), sec=col("Nombre Seccion"), dni=col("DNI","Documento","Numero Documento","Nro Documento","Nro. Documento","Documento Identidad","Numero Documento Identidad","Numero Doc"))
t = lambda f, k: str(f[c[k]]).strip() if f[c[k]] not in (None, "") else ""
n = 0
with open(destino, "w", newline="", encoding="utf-8-sig") as out:
    w = csv.writer(out)
    w.writerow(["Matrícula", "Nombre completo", "Puesto", "Situación", "Departamento", "Área", "Sección", "DNI"])
    for f in filas:
        cod = "".join(ch for ch in t(f, "cod") if ch.isdigit())
        if not cod:
            continue
        nombre = " ".join(x for x in (t(f, "nom"), t(f, "ap"), t(f, "am")) if x)
        w.writerow([cod.zfill(10), nombre, t(f, "puesto"), t(f, "sit"), t(f, "dep"), t(f, "area"), t(f, "sec"), "".join(ch for ch in t(f, "dni").upper() if ch.isalnum())])
        n += 1
print(n, "personas escritas en", destino)

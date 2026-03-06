#!/usr/bin/env python3
"""
Script de construcción del ejecutable portable.

Uso:
    python build_exe.py

Requisitos previos:
    pip install pyinstaller
    npm (Node.js) instalado

El ejecutable generado quedará en:
    dist/BIN-Filter          (Linux/Mac)
    dist/BIN-Filter.exe      (Windows)
"""

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
WEB_DIR = ROOT / "web"
DIST_DIR = ROOT / "dist"


def run(cmd, cwd=None):
    print(f"  > {' '.join(str(c) for c in cmd)}")
    result = subprocess.run(cmd, cwd=cwd)
    if result.returncode != 0:
        print(f"\n[ERROR] Comando falló con código {result.returncode}")
        sys.exit(result.returncode)


def step(msg):
    print(f"\n{'='*55}")
    print(f"  {msg}")
    print("=" * 55)


def main():
    print("\n  BIN Database Filter — Constructor de ejecutable portable")

    # ── 1. Instalar dependencias Python ──────────────────────────
    step("1/4  Instalando dependencias Python...")
    run([sys.executable, "-m", "pip", "install", "-r", str(ROOT / "app" / "requirements.txt"), "-q"])
    run([sys.executable, "-m", "pip", "install", "pyinstaller", "-q"])

    # ── 2. Construir frontend React ───────────────────────────────
    step("2/4  Construyendo frontend React...")
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"

    if not (WEB_DIR / "node_modules").exists():
        print("  Instalando paquetes npm (solo la primera vez)...")
        run([npm_cmd, "install"], cwd=WEB_DIR)

    run([npm_cmd, "run", "build"], cwd=WEB_DIR)

    built_dist = WEB_DIR / "dist"
    if not built_dist.exists():
        print("[ERROR] El build del frontend no generó web/dist")
        sys.exit(1)
    print(f"  Frontend listo en: {built_dist}")

    # ── 3. Limpiar build anterior ─────────────────────────────────
    step("3/4  Limpiando builds anteriores...")
    for d in ["build", "dist"]:
        p = ROOT / d
        if p.exists():
            shutil.rmtree(p)
            print(f"  Borrado: {p}")

    # ── 4. Construir ejecutable con PyInstaller ───────────────────
    step("4/4  Generando ejecutable con PyInstaller...")
    run([sys.executable, "-m", "PyInstaller", "--clean", str(ROOT / "app.spec")])

    exe_name = "BIN-Filter.exe" if sys.platform == "win32" else "BIN-Filter"
    exe_path = DIST_DIR / exe_name

    if not exe_path.exists():
        print(f"\n[ERROR] No se encontró el ejecutable en {exe_path}")
        sys.exit(1)

    print(f"""
{'='*55}
  LISTO!

  Ejecutable generado en:
    {exe_path}

  Para distribuirlo:
    - Copia el archivo  {exe_name}  a cualquier PC
    - Ejecútalo directamente (no necesita Python ni Node.js)
    - El CSV de datos (bin-list-data.csv) está incluido
    - También puedes cargar tu propio CSV desde la app
{'='*55}
""")


if __name__ == "__main__":
    main()

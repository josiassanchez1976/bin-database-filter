#!/usr/bin/env python3
"""
Launcher: instala dependencias, construye el frontend y abre la app en el navegador.
Uso: python run.py   (o doble clic en Windows si Python está asociado a .py)
"""
import os
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).parent
WEB_DIR = ROOT / "web"
DIST_DIR = WEB_DIR / "dist"
PORT = 8000
URL = f"http://localhost:{PORT}"


def run(cmd, cwd=None, check=True):
    print(f"  > {' '.join(cmd)}")
    subprocess.run(cmd, cwd=cwd, check=check)


def step(msg):
    print(f"\n{'='*50}")
    print(f"  {msg}")
    print('='*50)


# ── 1. Instalar dependencias Python ──────────────────
step("1/3  Instalando dependencias Python...")
run([sys.executable, "-m", "pip", "install", "-r", str(ROOT / "app" / "requirements.txt"), "-q"])

# ── 2. Construir frontend React ───────────────────────
step("2/3  Construyendo interfaz web...")
npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"

if not (WEB_DIR / "node_modules").exists():
    print("  Instalando paquetes npm (solo la primera vez)...")
    run([npm_cmd, "install"], cwd=WEB_DIR)

print("  Reconstruyendo frontend con los últimos cambios...")
run([npm_cmd, "run", "build"], cwd=WEB_DIR)

# ── 3. Iniciar servidor y abrir navegador ─────────────
step("3/3  Iniciando servidor...")
print(f"  La app estará disponible en: {URL}")
print("  Presiona Ctrl+C para cerrar.\n")


def open_browser():
    time.sleep(2)
    webbrowser.open(URL)


threading.Thread(target=open_browser, daemon=True).start()

uvicorn_cmd = [
    sys.executable, "-m", "uvicorn",
    "app.api:app",
    "--host", "0.0.0.0",
    "--port", str(PORT),
]
subprocess.run(uvicorn_cmd, cwd=ROOT)

#!/usr/bin/env python3
"""
Entry point para el ejecutable PyInstaller.
Levanta el servidor FastAPI y abre el navegador automáticamente.
"""
import multiprocessing
import os
import sys
import threading
import time
import webbrowser
from pathlib import Path


def resource_path(relative: str) -> str:
    """Resuelve rutas tanto en desarrollo como dentro del ejecutable PyInstaller."""
    base = getattr(sys, "_MEIPASS", Path(__file__).parent)
    return str(Path(base) / relative)


def open_browser(url: str, delay: float = 2.0):
    time.sleep(delay)
    webbrowser.open(url)


def main():
    # PyInstaller en Windows requiere esto para multiprocessing
    multiprocessing.freeze_support()

    port = 8000
    host = "127.0.0.1"
    url = f"http://{host}:{port}"

    # Cambiar el directorio de trabajo al directorio del ejecutable
    # para que los archivos CSV relativos se encuentren correctamente
    exe_dir = Path(sys.executable).parent if getattr(sys, "frozen", False) else Path(__file__).parent
    os.chdir(exe_dir)

    print("=" * 50)
    print("  BIN Database Filter")
    print("=" * 50)
    print(f"\n  Iniciando servidor en: {url}")
    print("  Presiona Ctrl+C para cerrar.\n")

    # Abrir el navegador en un thread separado
    threading.Thread(target=open_browser, args=(url,), daemon=True).start()

    # Iniciar uvicorn programáticamente (compatible con PyInstaller)
    import uvicorn

    # Indicar a la app donde están los archivos estáticos del frontend
    os.environ["WEB_DIST"] = resource_path("web/dist")

    uvicorn.run(
        "app.api:app",
        host=host,
        port=port,
        log_level="warning",
    )


if __name__ == "__main__":
    main()

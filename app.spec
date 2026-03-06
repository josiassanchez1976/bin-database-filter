# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec para BIN Database Filter.
Genera un ejecutable que incluye:
  - Backend FastAPI + uvicorn
  - Frontend React (web/dist)
  - Datos CSV por defecto
"""

from pathlib import Path
import os

ROOT = Path(SPECPATH)

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=[str(ROOT)],
    binaries=[],
    datas=[
        # Frontend React compilado
        (str(ROOT / 'web' / 'dist'), 'web/dist'),
        # Datos CSV por defecto (opcional, el usuario puede cargar el suyo)
        (str(ROOT / 'bin-list-data.csv'), '.'),
    ],
    hiddenimports=[
        # FastAPI / Starlette
        'uvicorn',
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.loops.asyncio',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.http.h11_impl',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'fastapi',
        'fastapi.staticfiles',
        'starlette',
        'starlette.staticfiles',
        'starlette.responses',
        'starlette.routing',
        'starlette.middleware',
        'starlette.middleware.cors',
        'anyio',
        'anyio._backends._asyncio',
        'h11',
        # Pandas
        'pandas',
        'pyarrow',
        'chardet',
        # Multipart
        'python_multipart',
        'multipart',
        # App modules
        'app',
        'app.api',
        'app.utils',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'scipy', 'numpy.testing'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='BIN-Filter',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,        # True = muestra consola (util para ver logs/errores)
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    # icon='icon.ico',   # Descomenta y agrega un icono si quieres
)

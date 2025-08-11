# BIN Database Filter

Aplicación para cargar y filtrar listas de BIN/IIN.

## Estructura

- `app/streamlit_app.py` – versión Streamlit.
- `app/api.py` – API FastAPI.
- `web/` – frontend React mínimo.
- `requirements.txt` – dependencias para la versión Streamlit.
- `app/requirements.txt` – dependencias para la API.
- `sample_bins.csv` – datos de ejemplo para pruebas.
- `bin-list-data-small.csv`/`bin-list-data.csv` – base de datos real (se carga automáticamente si está en la raíz).

## Ejecutar versión Streamlit

```bash
pip install -r requirements.txt
streamlit run app/streamlit_app.py
```
Carga por defecto el CSV real si está presente; también permite subir un archivo propio.

## Ejecutar versión FastAPI + React

Backend:
```bash
pip install -r app/requirements.txt
uvicorn app.api:app --reload
```
Frontend:
```bash
cd web
npm install
npm run dev
```
La SPA consume la API para paginar, aplicar filtros y descargar resultados.

## Tests

```bash
pip install -r requirements.txt
pytest
```

## Uso de datos

La aplicación intenta cargar por defecto `bin-list-data-small.csv` o `bin-list-data.csv` en la raíz. El usuario puede reemplazarlo subiendo otro CSV desde la interfaz (Streamlit) o mediante el endpoint `/upload` de la API.

Ejemplo rápido de uso en la API:

```
# Listar metadatos y mapeo de columnas
curl http://localhost:8000/meta

# Obtener BINs de un banco específico y descargar CSV
curl "http://localhost:8000/bins/export?include_bank=BankC" -o bins_filtrados.csv
```

En Streamlit, los filtros se encuentran en la barra lateral y el panel “Diagnóstico de columnas” permite reasignar manualmente las columnas detectadas.

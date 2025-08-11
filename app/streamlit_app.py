import io
from pathlib import Path
from typing import Dict, Optional

import pandas as pd
import streamlit as st

from app.utils import apply_filters, detect_columns, read_csv

DATA_FILES = ["bin-list-data-small.csv", "bin-list-data.csv"]

st.set_page_config(page_title="BIN Filter", layout="wide")


def load_data(upload_bytes: Optional[bytes]) -> tuple[pd.DataFrame, str]:
    """Load data from uploaded bytes or default CSV files."""
    if upload_bytes is not None:
        df, enc = read_csv(io.BytesIO(upload_bytes))
        return df, enc
    for fname in DATA_FILES:
        path = Path(fname)
        if path.exists():
            df, enc = read_csv(path)
            return df, enc
    st.error("No se encontró archivo de datos")
    st.stop()


@st.cache_data
def cached_load(upload_data: Optional[bytes]):
    return load_data(upload_data)


def diagnosis_panel(mapping: Dict[str, Optional[str]], columns: list[str]) -> Dict[str, Optional[str]]:
    st.write("Column mapping detected. You may override:")
    new_mapping = {}
    for dim, col in mapping.items():
        new_mapping[dim] = st.selectbox(dim, [None] + columns, index=(columns.index(col) + 1) if col in columns else 0)
    return new_mapping


upload = st.file_uploader("Upload CSV", type="csv")
upload_bytes = upload.getvalue() if upload is not None else None

df, encoding = cached_load(upload_bytes)
column_mapping = detect_columns(df)
columns = list(df.columns)

with st.expander("Diagnóstico de columnas", expanded=False):
    column_mapping = diagnosis_panel(column_mapping, columns)

st.sidebar.header("Filtros")

prefix = st.sidebar.text_input("BIN comienza con", max_chars=8)

include_bank = exclude_bank = None
if column_mapping.get("bank"):
    banks = sorted(df[column_mapping["bank"]].dropna().unique())
    include_bank = st.sidebar.multiselect("Banco / Emisor - incluir", banks)
    exclude_bank = st.sidebar.multiselect("Banco / Emisor - excluir", banks)

include_brand = None
if column_mapping.get("brand"):
    brands = sorted(df[column_mapping["brand"]].dropna().unique())
    include_brand = st.sidebar.multiselect("Marca", brands)

include_type = None
if column_mapping.get("type"):
    types = sorted(df[column_mapping["type"]].dropna().unique())
    include_type = st.sidebar.multiselect("Tipo", types)

include_level = exclude_level = None
if column_mapping.get("level"):
    levels = sorted(df[column_mapping["level"]].dropna().unique())
    include_level = st.sidebar.multiselect("Nivel / Categoría - incluir", levels)
    exclude_level = st.sidebar.multiselect("Nivel / Categoría - excluir", levels)

include_country = None
if column_mapping.get("country"):
    countries = sorted(df[column_mapping["country"]].dropna().unique())
    include_country = st.sidebar.multiselect("País", countries)

include_country_code = None
if column_mapping.get("country_code"):
    codes = sorted(df[column_mapping["country_code"]].dropna().unique())
    include_country_code = st.sidebar.multiselect("Código ISO", codes)

prepaid = None
if column_mapping.get("prepaid"):
    prepaid_opt = st.sidebar.selectbox("Prepago", ["Cualquiera", "Sí", "No"])
    if prepaid_opt == "Sí":
        prepaid = True
    elif prepaid_opt == "No":
        prepaid = False

text = st.sidebar.text_input("Texto libre")

dedupe = st.sidebar.checkbox("Deduplicar por BIN")

show_columns = st.sidebar.multiselect("Columnas a mostrar", columns, default=columns[:6])

filtered = apply_filters(
    df,
    column_mapping,
    prefix=prefix or None,
    include_bank=include_bank,
    exclude_bank=exclude_bank,
    include_brand=include_brand,
    include_type=include_type,
    include_level=include_level,
    exclude_level=exclude_level,
    include_country=include_country,
    include_country_code=include_country_code,
    prepaid=prepaid,
    text=text or None,
    dedupe=dedupe,
)

st.write(f"Filas filtradas {len(filtered)} de {len(df)} | Columnas {len(filtered.columns)} | Codificación {encoding}")

st.dataframe(filtered[show_columns])

csv = filtered.to_csv(index=False).encode("utf-8")
st.download_button("Descargar CSV", csv, "bins_filtrados.csv", "text/csv")

if column_mapping.get("brand"):
    st.subheader("Top 50 Brand")
    st.write(filtered[column_mapping["brand"]].value_counts().head(50))
if column_mapping.get("type"):
    st.subheader("Top 50 Type")
    st.write(filtered[column_mapping["type"]].value_counts().head(50))
if column_mapping.get("level"):
    st.subheader("Top 50 Level")
    st.write(filtered[column_mapping["level"]].value_counts().head(50))

from __future__ import annotations

import io
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

from .utils import apply_filters, detect_columns, read_csv

# possible default data files in order of preference
DATA_FILES = ["bin-list-data-small.csv", "bin-list-data.csv"]

app = FastAPI(title="BIN Filter API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"]
    ,allow_headers=["*"]
)


class DataStore:
    df: pd.DataFrame | None = None
    encoding: str = "utf-8"
    mapping: Dict[str, Optional[str]] = {}


STORE = DataStore()


def load_default() -> None:
    """Load default CSV from disk if available."""
    for fname in DATA_FILES:
        path = Path(fname)
        if path.exists():
            df, enc = read_csv(path)
            STORE.df = df
            STORE.encoding = enc
            STORE.mapping = detect_columns(df)
            break


load_default()


@app.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    """Upload a new CSV replacing current data."""
    content = await file.read()
    df, enc = read_csv(io.BytesIO(content))
    STORE.df = df
    STORE.encoding = enc
    STORE.mapping = detect_columns(df)
    return {"rows": len(df), "encoding": enc}


@app.get("/meta")
async def meta():
    """Return current column mapping and available filter options."""
    if STORE.df is None:
        raise HTTPException(status_code=400, detail="No data loaded")
    options: Dict[str, List[str]] = {}
    for dim, col in STORE.mapping.items():
        if col and col in STORE.df:
            options[dim] = sorted(STORE.df[col].dropna().unique().tolist())
    return {
        "mapping": STORE.mapping,
        "options": options,
        "columns": list(STORE.df.columns),
    }


@app.post("/mapping")
async def set_mapping(new_mapping: Dict[str, Optional[str]]):
    """Override column mapping manually."""
    if STORE.df is None:
        raise HTTPException(status_code=400, detail="No data loaded")
    cols = set(STORE.df.columns)
    cleaned: Dict[str, Optional[str]] = {}
    for dim, col in new_mapping.items():
        cleaned[dim] = col if col in cols else None
    STORE.mapping = cleaned
    return {"mapping": STORE.mapping}


@app.get("/bins")
async def bins(
    prefix: Optional[str] = None,
    include_bank: Optional[List[str]] = None,
    exclude_bank: Optional[List[str]] = None,
    include_brand: Optional[List[str]] = None,
    include_type: Optional[List[str]] = None,
    include_level: Optional[List[str]] = None,
    exclude_level: Optional[List[str]] = None,
    include_country: Optional[List[str]] = None,
    include_country_code: Optional[List[str]] = None,
    prepaid: Optional[str] = None,
    text: Optional[str] = None,
    dedupe: bool = False,
    page: int = 1,
    page_size: int = 50,
    columns: Optional[List[str]] = None,
):
    if STORE.df is None:
        raise HTTPException(status_code=400, detail="No data loaded")
    bool_prepaid = None
    if prepaid is not None:
        if prepaid.lower() in {"true", "1", "yes"}:
            bool_prepaid = True
        elif prepaid.lower() in {"false", "0", "no"}:
            bool_prepaid = False
    filtered = apply_filters(
        STORE.df,
        STORE.mapping,
        prefix=prefix,
        include_bank=include_bank,
        exclude_bank=exclude_bank,
        include_brand=include_brand,
        include_type=include_type,
        include_level=include_level,
        exclude_level=exclude_level,
        include_country=include_country,
        include_country_code=include_country_code,
        prepaid=bool_prepaid,
        text=text,
        dedupe=dedupe,
    )
    total = len(filtered)
    start = (page - 1) * page_size
    end = start + page_size
    data = filtered.iloc[start:end]
    if columns:
        data = data[columns]
    return {
        "data": data.to_dict(orient="records"),
        "total": total,
        "page": page,
        "page_size": page_size,
        "encoding": STORE.encoding,
    }


@app.get("/bins/export")
async def bins_export(
    prefix: Optional[str] = None,
    include_bank: Optional[List[str]] = None,
    exclude_bank: Optional[List[str]] = None,
    include_brand: Optional[List[str]] = None,
    include_type: Optional[List[str]] = None,
    include_level: Optional[List[str]] = None,
    exclude_level: Optional[List[str]] = None,
    include_country: Optional[List[str]] = None,
    include_country_code: Optional[List[str]] = None,
    prepaid: Optional[str] = None,
    text: Optional[str] = None,
    dedupe: bool = False,
    columns: Optional[List[str]] = None,
):
    if STORE.df is None:
        raise HTTPException(status_code=400, detail="No data loaded")
    bool_prepaid = None
    if prepaid is not None:
        if prepaid.lower() in {"true", "1", "yes"}:
            bool_prepaid = True
        elif prepaid.lower() in {"false", "0", "no"}:
            bool_prepaid = False
    filtered = apply_filters(
        STORE.df,
        STORE.mapping,
        prefix=prefix,
        include_bank=include_bank,
        exclude_bank=exclude_bank,
        include_brand=include_brand,
        include_type=include_type,
        include_level=include_level,
        exclude_level=exclude_level,
        include_country=include_country,
        include_country_code=include_country_code,
        prepaid=bool_prepaid,
        text=text,
        dedupe=dedupe,
    )
    if columns:
        filtered = filtered[columns]
    csv_bytes = filtered.to_csv(index=False).encode("utf-8")
    return StreamingResponse(io.BytesIO(csv_bytes), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=bins_filtrados.csv"})

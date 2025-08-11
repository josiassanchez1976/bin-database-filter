"""Utility functions for BIN CSV processing."""
from __future__ import annotations

import io
import unicodedata
from typing import Dict, List, Optional, Tuple

import pandas as pd

# Encodings to try when reading CSV
ENCODINGS = ["utf-8", "utf-8-sig", "latin-1", "cp1252"]

# Mapping of logical dimensions to possible column name synonyms
COLUMN_SYNONYMS = {
    "bin": ["bin", "iin", "bin_number", "first6", "prefix"],
    "bank": ["bank", "issuer", "bank_name", "issuer_name", "institution"],
    "brand": ["brand", "scheme", "network", "card_scheme"],
    "type": ["type", "card_type", "funding", "debit_credit"],
    "level": ["level", "category", "card_category", "tier", "class"],
    "country": ["country", "country_name"],
    "country_code": [
        "country_code",
        "alpha_2",
        "alpha2",
        "alpha_3",
        "alpha3",
        "iso2",
        "iso3",
    ],
    "currency": ["currency", "iso_currency", "currency_code"],
    "prepaid": ["prepaid", "is_prepaid", "prepago"],
    "bank_url": ["bank_url", "website"],
    "bank_phone": ["bank_phone", "phone"],
    "bank_city": ["bank_city", "city"],
    "bank_state": ["bank_state", "state", "region"],
}


def normalize_column_name(name: str) -> str:
    """Normalize a column name: lowercase, remove accents, replace spaces/hyphens."""
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    name = name.strip().lower().replace("-", "_").replace(" ", "_")
    return name


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Return copy of df with normalized column names."""
    df = df.copy()
    df.columns = [normalize_column_name(c) for c in df.columns]
    return df


def read_csv(path_or_buffer: io.BytesIO | str) -> Tuple[pd.DataFrame, str]:
    """Read CSV trying multiple encodings. Returns dataframe and detected encoding."""
    last_error: Optional[Exception] = None
    for enc in ENCODINGS:
        try:
            df = pd.read_csv(path_or_buffer, dtype="string", encoding=enc)
            return normalize_columns(df), enc
        except Exception as e:  # pragma: no cover - diagnostic only
            last_error = e
            if isinstance(path_or_buffer, (str, bytes, bytearray)):
                # reopen for next attempt
                continue
            else:
                path_or_buffer.seek(0)
    raise RuntimeError(f"Unable to read CSV: {last_error}")


def detect_columns(df: pd.DataFrame) -> Dict[str, Optional[str]]:
    """Detect column names for each logical dimension."""
    cols = list(df.columns)
    mapping: Dict[str, Optional[str]] = {k: None for k in COLUMN_SYNONYMS}
    for dim, options in COLUMN_SYNONYMS.items():
        exact_matches = [c for c in cols if c in options]
        if exact_matches:
            mapping[dim] = exact_matches[0]
            continue
        partial_matches = []
        for c in cols:
            for opt in options:
                if opt in c:
                    partial_matches.append(c)
                    break
        if partial_matches:
            mapping[dim] = partial_matches[0]
    return mapping


def parse_bool(value: str) -> Optional[bool]:
    """Robust conversion of strings to boolean."""
    if value is None:
        return None
    value = str(value).strip().lower()
    if value in {"yes", "y", "true", "1"}:
        return True
    if value in {"no", "n", "false", "0"}:
        return False
    return None


def apply_filters(
    df: pd.DataFrame,
    mapping: Dict[str, Optional[str]],
    *,
    prefix: Optional[str] = None,
    include_bank: Optional[List[str]] = None,
    exclude_bank: Optional[List[str]] = None,
    include_brand: Optional[List[str]] = None,
    include_type: Optional[List[str]] = None,
    include_level: Optional[List[str]] = None,
    exclude_level: Optional[List[str]] = None,
    include_country: Optional[List[str]] = None,
    include_country_code: Optional[List[str]] = None,
    prepaid: Optional[bool] = None,
    text: Optional[str] = None,
    dedupe: bool = False,
) -> pd.DataFrame:
    """Filter dataframe according to provided filters."""
    result = df.copy()
    bin_col = mapping.get("bin")
    if prefix and bin_col and bin_col in result:
        result = result[result[bin_col].str.startswith(prefix)]
    if include_bank and (col := mapping.get("bank")):
        result = result[result[col].isin(include_bank)]
    if exclude_bank and (col := mapping.get("bank")):
        result = result[~result[col].isin(exclude_bank)]
    if include_brand and (col := mapping.get("brand")):
        result = result[result[col].isin(include_brand)]
    if include_type and (col := mapping.get("type")):
        result = result[result[col].isin(include_type)]
    if include_level and (col := mapping.get("level")):
        result = result[result[col].isin(include_level)]
    if exclude_level and (col := mapping.get("level")):
        result = result[~result[col].isin(exclude_level)]
    if include_country and (col := mapping.get("country")):
        result = result[result[col].isin(include_country)]
    if include_country_code and (col := mapping.get("country_code")):
        result = result[result[col].isin(include_country_code)]
    if prepaid is not None and (col := mapping.get("prepaid")):
        bool_series = result[col].map(parse_bool)
        result = result[bool_series == prepaid]
    if text:
        text = text.lower()
        searchable_cols = [c for c in result.columns if result[c].dtype == "string"]
        mask = pd.Series(False, index=result.index)
        for c in searchable_cols:
            mask |= result[c].fillna("").str.lower().str.contains(text)
        result = result[mask]
    if dedupe and bin_col and bin_col in result:
        result = result.drop_duplicates(subset=[bin_col])
    return result


__all__ = [
    "read_csv",
    "normalize_columns",
    "detect_columns",
    "apply_filters",
    "parse_bool",
]

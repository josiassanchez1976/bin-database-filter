from pathlib import Path
import pandas as pd

from app.utils import normalize_columns, detect_columns, apply_filters, read_csv
from app.api import app, STORE
from fastapi.testclient import TestClient


def load_sample_df():
    path = Path('sample_bins.csv')
    df = pd.read_csv(path, dtype='string')
    df = normalize_columns(df)
    return df


def test_normalize_columns():
    df = pd.DataFrame({'Bank Name': ['A']})
    df2 = normalize_columns(df)
    assert 'bank_name' in df2.columns


def test_detect_columns():
    df = load_sample_df()
    mapping = detect_columns(df)
    assert mapping['bin'] == 'bin'
    assert mapping['bank'] == 'bank'


def test_apply_filters_prefix():
    df = load_sample_df()
    mapping = detect_columns(df)
    filt = apply_filters(df, mapping, prefix='400000')
    assert all(filt['bin'].str.startswith('400000'))


def test_apply_filters_bank_include_exclude():
    df = load_sample_df()
    mapping = detect_columns(df)
    banks = df['bank'].unique().tolist()
    chosen = banks[0]
    filtered = apply_filters(df, mapping, include_bank=[chosen])
    assert set(filtered['bank']) == {chosen}
    filtered2 = apply_filters(df, mapping, exclude_bank=[chosen])
    assert chosen not in set(filtered2['bank'])


def test_deduplicate():
    df = load_sample_df()
    mapping = detect_columns(df)
    df_dup = pd.concat([df, df.iloc[[0]]])
    filtered = apply_filters(df_dup, mapping, dedupe=True)
    assert len(filtered) == len(df)


def test_detect_columns_synonyms():
    df = pd.DataFrame({
        'issuer_name': ['Bank'],
        'alpha_2': ['US'],
        'is_prepaid': ['yes'],
        'bin_number': ['123456'],
    }, dtype='string')
    df = normalize_columns(df)
    mapping = detect_columns(df)
    assert mapping['bank'] == 'issuer_name'
    assert mapping['country_code'] == 'alpha_2'
    assert mapping['prepaid'] == 'is_prepaid'
    assert mapping['bin'] == 'bin_number'


def test_apply_filters_extended():
    df = load_sample_df()
    mapping = detect_columns(df)
    brand = df[mapping['brand']].dropna().unique()[0]
    assert set(apply_filters(df, mapping, include_brand=[brand])[mapping['brand']]) == {brand}
    ctype = df[mapping['type']].dropna().unique()[0]
    assert set(apply_filters(df, mapping, include_type=[ctype])[mapping['type']]) == {ctype}
    level = df[mapping['level']].dropna().unique()[0]
    assert set(apply_filters(df, mapping, include_level=[level])[mapping['level']]) == {level}
    assert level not in set(apply_filters(df, mapping, exclude_level=[level])[mapping['level']])
    country = df[mapping['country']].dropna().unique()[0]
    assert set(apply_filters(df, mapping, include_country=[country])[mapping['country']]) == {country}
    code = df[mapping['country_code']].dropna().unique()[0]
    assert set(apply_filters(df, mapping, include_country_code=[code])[mapping['country_code']]) == {code}
    assert all(apply_filters(df, mapping, prepaid=True)[mapping['prepaid']].str.lower().isin(['yes', 'true', '1']))
    bank_val = df[mapping['bank']].dropna().iloc[0]
    assert not apply_filters(df, mapping, text=bank_val[:2].lower()).empty


def test_export_endpoint(tmp_path):
    df, _ = read_csv('sample_bins.csv')
    STORE.df = df
    STORE.encoding = 'utf-8'
    STORE.mapping = detect_columns(df)
    client = TestClient(app)
    resp = client.get('/bins/export?prefix=400000')
    assert resp.status_code == 200
    assert '400000' in resp.text

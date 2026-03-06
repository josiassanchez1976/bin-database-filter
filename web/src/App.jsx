import React, { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_PAGE_SIZE = 50;

// ----- Debounce hook -----
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// ----- MultiSelect as searchable checkboxes -----
function MultiCheck({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = value || [];

  const toggle = (opt) =>
    onChange(selected.includes(opt) ? selected.filter(x => x !== opt) : [...selected, opt]);

  const filtered = options.filter(o =>
    String(o).toLowerCase().includes(search.toLowerCase())
  );

  const selectAll = () => onChange([...new Set([...selected, ...filtered])]);
  const clearAll = () => onChange(selected.filter(s => !filtered.includes(s)));

  return (
    <div className="filter-group">
      <button className="multicheck-toggle" onClick={() => { setOpen(o => !o); setSearch(''); }}>
        {label} {selected.length > 0 && <span className="badge">{selected.length}</span>}
        <span className="arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="multicheck-list">
          <div className="multicheck-search-row">
            <input
              className="multicheck-search"
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className="multicheck-actions">
            <button className="link-btn" onClick={selectAll}>Seleccionar todos</button>
            <span style={{ color: '#d1d5db' }}>|</span>
            <button className="link-btn" onClick={clearAll}>Limpiar</button>
            <span className="multicheck-count">{filtered.length} opciones</span>
          </div>
          <div className="multicheck-items">
            {filtered.length === 0
              ? <div style={{ padding: '0.4rem', color: '#9ca3af', fontSize: '0.82rem' }}>Sin resultados</div>
              : filtered.map(opt => (
                <label key={opt} className="multicheck-item">
                  <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} />
                  {opt}
                </label>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ----- Main App -----
export default function App() {
  const [options, setOptions] = useState({});
  const [mapping, setMapping] = useState({});
  const [columns, setColumns] = useState([]);
  const [filters, setFilters] = useState({ page: 1, page_size: DEFAULT_PAGE_SIZE });
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(true);
  const [showDiag, setShowDiag] = useState(false);
  const [diagMap, setDiagMap] = useState({});
  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Inputs with debounce
  const [prefixInput, setPrefixInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const debouncedPrefix = useDebounce(prefixInput, 300);
  const debouncedText = useDebounce(textInput, 300);

  // Sync debounced values into filters
  useEffect(() => {
    setFilters(f => ({ ...f, prefix: debouncedPrefix, page: 1 }));
  }, [debouncedPrefix]);

  useEffect(() => {
    setFilters(f => ({ ...f, text: debouncedText, page: 1 }));
  }, [debouncedText]);

  const loadMeta = useCallback(() => {
    return fetch('/meta')
      .then(r => {
        if (!r.ok) throw new Error(`Error ${r.status}: ${r.statusText}`);
        return r.json();
      })
      .then(res => {
        setOptions(res.options);
        setMapping(res.mapping);
        setColumns(res.columns);
        setError(null);
      })
      .catch(err => setError(err.message));
  }, []);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  const buildParams = useCallback((f = filters) => {
    const params = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => {
      if (Array.isArray(v)) v.forEach(val => params.append(k, val));
      else if (v !== undefined && v !== '' && v !== false) params.append(k, v);
    });
    return params;
  }, [filters]);

  useEffect(() => {
    const params = buildParams();
    setLoading(true);
    setError(null);
    fetch('/bins?' + params.toString())
      .then(r => {
        if (!r.ok) throw new Error(`Error ${r.status}: ${r.statusText}`);
        return r.json();
      })
      .then(res => {
        setData(res.data);
        setTotal(res.total);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  const updateFilter = (k, v) => setFilters(f => ({ ...f, [k]: v, page: 1 }));
  const resetFilters = () => {
    setFilters({ page: 1, page_size: DEFAULT_PAGE_SIZE });
    setPrefixInput('');
    setTextInput('');
  };

  const copyClipboard = () => {
    if (!data.length) return;
    const header = Object.keys(data[0]).join(',');
    const lines = data.map(row => Object.values(row).join(','));
    navigator.clipboard.writeText([header, ...lines].join('\n'));
  };

  const activeFilters = Object.entries(filters).filter(([k, v]) => {
    if (['page', 'page_size'].includes(k)) return false;
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== '' && v !== false;
  }).length;

  const downloadUrl = '/bins/export?' + buildParams().toString();

  const currentPage = filters.page || 1;
  const pageSize = filters.page_size || DEFAULT_PAGE_SIZE;
  const totalPages = Math.ceil(total / pageSize);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    setUploading(true);
    setUploadStatus(null);
    try {
      const res = await fetch('/upload', { method: 'POST', body: form });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = await res.json();
      setUploadStatus({ ok: true, msg: `Cargado: ${json.rows} filas (${json.encoding})` });
      await loadMeta();
      setFilters({ page: 1, page_size: pageSize });
    } catch (err) {
      setUploadStatus({ ok: false, msg: err.message });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const saveDiag = () => {
    fetch('/mapping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(diagMap),
    })
      .then(() => loadMeta())
      .then(() => {
        setFilters({ page: 1, page_size: pageSize });
        setShowDiag(false);
      });
  };

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; font-family: system-ui, sans-serif; background: #f5f7fa; color: #1a1a2e; }
        .app { display: flex; flex-direction: column; min-height: 100vh; }
        .topbar {
          background: #1a1a2e; color: #fff; padding: 0.75rem 1.25rem;
          display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
        }
        .topbar h1 { margin: 0; font-size: 1.1rem; font-weight: 700; flex: 1; }
        .btn {
          padding: 0.35rem 0.75rem; border: none; border-radius: 5px; cursor: pointer;
          font-size: 0.85rem; font-weight: 600; transition: opacity 0.15s;
        }
        .btn:disabled { opacity: 0.4; cursor: default; }
        .btn:hover:not(:disabled) { opacity: 0.85; }
        .btn-primary { background: #4f46e5; color: #fff; }
        .btn-secondary { background: #e5e7eb; color: #374151; }
        .btn-danger { background: #ef4444; color: #fff; }
        .btn-outline { background: transparent; border: 1px solid #d1d5db; color: #374151; }
        .badge {
          display: inline-block; background: #4f46e5; color: #fff;
          border-radius: 10px; padding: 0 6px; font-size: 0.75rem; margin-left: 4px;
        }
        .badge-gray { background: #6b7280; }
        .layout { display: flex; flex: 1; overflow: hidden; }
        .sidebar {
          width: 280px; min-width: 280px; background: #fff; border-right: 1px solid #e5e7eb;
          overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem;
        }
        .sidebar.hidden { display: none; }
        .main { flex: 1; overflow: auto; padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
        .filter-group { display: flex; flex-direction: column; gap: 0.25rem; }
        .filter-label { font-size: 0.78rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.03em; }
        .filter-input {
          width: 100%; padding: 0.35rem 0.5rem; border: 1px solid #d1d5db;
          border-radius: 5px; font-size: 0.875rem; outline: none;
        }
        .filter-input:focus { border-color: #4f46e5; box-shadow: 0 0 0 2px rgba(79,70,229,0.15); }
        .filter-select { width: 100%; padding: 0.35rem 0.5rem; border: 1px solid #d1d5db; border-radius: 5px; font-size: 0.875rem; }
        .multicheck-toggle {
          width: 100%; display: flex; align-items: center; justify-content: space-between;
          padding: 0.35rem 0.5rem; background: #f9fafb; border: 1px solid #d1d5db;
          border-radius: 5px; cursor: pointer; font-size: 0.875rem; text-align: left;
        }
        .arrow { margin-left: auto; font-size: 0.7rem; color: #9ca3af; }
        .multicheck-list {
          border: 1px solid #e5e7eb; border-radius: 5px; background: #fff;
          display: flex; flex-direction: column;
        }
        .multicheck-search-row { padding: 0.35rem 0.4rem; border-bottom: 1px solid #f3f4f6; }
        .multicheck-search {
          width: 100%; padding: 0.3rem 0.5rem; border: 1px solid #d1d5db;
          border-radius: 4px; font-size: 0.82rem; outline: none;
        }
        .multicheck-search:focus { border-color: #4f46e5; }
        .multicheck-actions {
          display: flex; align-items: center; gap: 0.4rem; padding: 0.25rem 0.5rem;
          border-bottom: 1px solid #f3f4f6; font-size: 0.78rem;
        }
        .multicheck-count { margin-left: auto; color: #9ca3af; font-size: 0.75rem; }
        .multicheck-items { max-height: 160px; overflow-y: auto; padding: 0.2rem; }
        .multicheck-item {
          display: flex; align-items: center; gap: 0.4rem; padding: 0.2rem 0.4rem;
          font-size: 0.85rem; cursor: pointer; border-radius: 3px;
        }
        .multicheck-item:hover { background: #f3f4f6; }
        .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 0.75rem; }
        .toolbar { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
        .status-bar { font-size: 0.825rem; color: #6b7280; margin-left: auto; }
        .error-box { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; border-radius: 6px; padding: 0.6rem 0.9rem; font-size: 0.875rem; }
        .success-box { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; border-radius: 6px; padding: 0.6rem 0.9rem; font-size: 0.875rem; }
        .table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        thead th { background: #f9fafb; border-bottom: 2px solid #e5e7eb; padding: 0.5rem 0.75rem; text-align: left; font-weight: 600; white-space: nowrap; }
        tbody tr:nth-child(even) { background: #f9fafb; }
        tbody td { border-bottom: 1px solid #f3f4f6; padding: 0.4rem 0.75rem; white-space: nowrap; }
        .pagination { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
        .page-info { font-size: 0.85rem; color: #6b7280; }
        .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid #e5e7eb; border-top-color: #4f46e5; border-radius: 50%; animation: spin 0.6s linear infinite; vertical-align: middle; margin-right: 6px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .upload-zone { border: 2px dashed #d1d5db; border-radius: 6px; padding: 0.75rem; text-align: center; cursor: pointer; font-size: 0.85rem; color: #6b7280; transition: border-color 0.2s; }
        .upload-zone:hover { border-color: #4f46e5; color: #4f46e5; }
        .divider { border: none; border-top: 1px solid #e5e7eb; margin: 0.25rem 0; }
        .sidebar-section-title { font-size: 0.7rem; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0.25rem; }
        .active-chips { display: flex; flex-wrap: wrap; gap: 0.3rem; }
        .chip { background: #ede9fe; color: #4f46e5; border-radius: 12px; padding: 0.1rem 0.6rem; font-size: 0.78rem; font-weight: 600; }
        .empty-msg { text-align: center; color: #9ca3af; padding: 2rem; font-size: 0.95rem; }
        .page-size-select { padding: 0.3rem 0.5rem; border: 1px solid #d1d5db; border-radius: 5px; font-size: 0.82rem; }
        .link-btn { background: none; border: none; color: #4f46e5; cursor: pointer; font-size: 0.85rem; font-weight: 600; text-decoration: underline; padding: 0; }
      `}</style>

      <div className="app">
        {/* Top bar */}
        <div className="topbar">
          <h1>BIN Database Filter</h1>
          <button className="btn btn-secondary" onClick={() => setShowFilters(s => !s)}>
            {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
            {activeFilters > 0 && <span className="badge">{activeFilters}</span>}
          </button>
          <button className="btn btn-secondary" onClick={() => { setDiagMap(mapping); setShowDiag(true); }}>
            Diagnóstico
          </button>
        </div>

        <div className="layout">
          {/* Sidebar */}
          <div className={`sidebar${showFilters ? '' : ' hidden'}`}>
            <div className="sidebar-section-title">Subir archivo</div>
            <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
              {uploading ? <><span className="spinner" /> Subiendo...</> : '📂 Haz clic para subir CSV'}
            </div>
            <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleUpload} />
            {uploadStatus && (
              <div className={uploadStatus.ok ? 'success-box' : 'error-box'}>{uploadStatus.msg}</div>
            )}

            <hr className="divider" />
            <div className="sidebar-section-title">Filtros</div>

            <div className="filter-group">
              <label className="filter-label">BIN Prefix</label>
              <input className="filter-input" placeholder="ej. 4000" maxLength={8}
                value={prefixInput} onChange={e => setPrefixInput(e.target.value)} />
            </div>

            <div className="filter-group">
              <label className="filter-label">Texto libre</label>
              <input className="filter-input" placeholder="Buscar en todos los campos..."
                value={textInput} onChange={e => setTextInput(e.target.value)} />
            </div>

            {mapping.bank && options.bank && (
              <MultiCheck label="Banco incluir" options={options.bank}
                value={filters.include_bank} onChange={v => updateFilter('include_bank', v)} />
            )}
            {mapping.bank && options.bank && (
              <MultiCheck label="Banco excluir" options={options.bank}
                value={filters.exclude_bank} onChange={v => updateFilter('exclude_bank', v)} />
            )}
            {mapping.brand && options.brand && (
              <MultiCheck label="Marca" options={options.brand}
                value={filters.include_brand} onChange={v => updateFilter('include_brand', v)} />
            )}
            {mapping.type && options.type && (
              <MultiCheck label="Tipo" options={options.type}
                value={filters.include_type} onChange={v => updateFilter('include_type', v)} />
            )}
            {mapping.level && options.level && (
              <MultiCheck label="Nivel incluir" options={options.level}
                value={filters.include_level} onChange={v => updateFilter('include_level', v)} />
            )}
            {mapping.level && options.level && (
              <MultiCheck label="Nivel excluir" options={options.level}
                value={filters.exclude_level} onChange={v => updateFilter('exclude_level', v)} />
            )}
            {mapping.country && options.country && (
              <MultiCheck label="País" options={options.country}
                value={filters.include_country} onChange={v => updateFilter('include_country', v)} />
            )}
            {mapping.country_code && options.country_code && (
              <MultiCheck label="Código ISO" options={options.country_code}
                value={filters.include_country_code} onChange={v => updateFilter('include_country_code', v)} />
            )}
            {mapping.prepaid && (
              <div className="filter-group">
                <label className="filter-label">Prepago</label>
                <select className="filter-select" value={filters.prepaid || ''}
                  onChange={e => updateFilter('prepaid', e.target.value)}>
                  <option value="">Cualquiera</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              </div>
            )}

            <div className="filter-group">
              <label className="multicheck-item">
                <input type="checkbox" checked={filters.dedupe || false}
                  onChange={e => updateFilter('dedupe', e.target.checked)} />
                Deduplicar BINs
              </label>
            </div>

            {columns.length > 0 && (
              <div className="filter-group">
                <label className="filter-label">Columnas a mostrar</label>
                <MultiCheck label="Seleccionar columnas" options={columns}
                  value={filters.columns} onChange={v => updateFilter('columns', v)} />
              </div>
            )}

            {activeFilters > 0 && (
              <>
                <hr className="divider" />
                <button className="btn btn-danger" onClick={resetFilters}>Limpiar filtros ({activeFilters})</button>
              </>
            )}
          </div>

          {/* Main content */}
          <div className="main">
            {error && <div className="error-box">⚠️ {error}</div>}

            {activeFilters > 0 && (
              <div className="card">
                <div className="active-chips">
                  {filters.prefix && <span className="chip">Prefix: {filters.prefix}</span>}
                  {filters.text && <span className="chip">Texto: "{filters.text}"</span>}
                  {filters.prepaid && <span className="chip">Prepago: {filters.prepaid === 'true' ? 'Sí' : 'No'}</span>}
                  {filters.dedupe && <span className="chip">Deduplicado</span>}
                  {(filters.include_bank || []).map(v => <span key={v} className="chip">Banco: {v}</span>)}
                  {(filters.exclude_bank || []).map(v => <span key={v} className="chip">¬Banco: {v}</span>)}
                  {(filters.include_brand || []).map(v => <span key={v} className="chip">Marca: {v}</span>)}
                  {(filters.include_type || []).map(v => <span key={v} className="chip">Tipo: {v}</span>)}
                  {(filters.include_level || []).map(v => <span key={v} className="chip">Nivel: {v}</span>)}
                  {(filters.exclude_level || []).map(v => <span key={v} className="chip">¬Nivel: {v}</span>)}
                  {(filters.include_country || []).map(v => <span key={v} className="chip">País: {v}</span>)}
                  {(filters.include_country_code || []).map(v => <span key={v} className="chip">ISO: {v}</span>)}
                </div>
              </div>
            )}

            <div className="card">
              <div className="toolbar">
                <button className="btn btn-secondary" onClick={copyClipboard} disabled={!data.length}>
                  Copiar visibles
                </button>
                <a href={downloadUrl} className="btn btn-primary">Descargar CSV</a>
                <label className="page-info">
                  Filas por página:&nbsp;
                  <select className="page-size-select" value={pageSize}
                    onChange={e => setFilters(f => ({ ...f, page_size: Number(e.target.value), page: 1 }))}>
                    {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <div className="status-bar">
                  {loading && <span className="spinner" />}
                  {!loading && `${total.toLocaleString()} resultado${total !== 1 ? 's' : ''}`}
                </div>
              </div>

              <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
                {loading && !data.length ? (
                  <div className="empty-msg"><span className="spinner" /> Cargando...</div>
                ) : data.length === 0 ? (
                  <div className="empty-msg">Sin resultados para los filtros actuales.</div>
                ) : (
                  <table>
                    <thead>
                      <tr>{data[0] && Object.keys(data[0]).map(k => <th key={k}>{k}</th>)}</tr>
                    </thead>
                    <tbody>
                      {data.map((row, i) => (
                        <tr key={i}>{Object.values(row).map((v, j) => <td key={j}>{String(v ?? '')}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="pagination" style={{ marginTop: '0.75rem' }}>
                <button className="btn btn-outline" disabled={currentPage <= 1}
                  onClick={() => setFilters(f => ({ ...f, page: currentPage - 1 }))}>
                  ← Anterior
                </button>
                <span className="page-info">Página {currentPage} de {totalPages || 1}</span>
                <button className="btn btn-outline" disabled={currentPage >= totalPages}
                  onClick={() => setFilters(f => ({ ...f, page: currentPage + 1 }))}>
                  Siguiente →
                </button>
                <span className="page-info" style={{ marginLeft: 'auto' }}>
                  Mostrando {Math.min((currentPage - 1) * pageSize + 1, total)}–{Math.min(currentPage * pageSize, total)} de {total.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Diagnosis modal */}
      {showDiag && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setShowDiag(false)}>
          <div style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', width: '340px', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Diagnóstico de columnas</h3>
            <p style={{ fontSize: '0.82rem', color: '#6b7280' }}>Asigna manualmente cada dimensión a una columna del CSV.</p>
            {Object.keys(mapping).map(dim => (
              <div key={dim} className="filter-group" style={{ marginBottom: '0.5rem' }}>
                <label className="filter-label">{dim}</label>
                <select className="filter-select" value={diagMap[dim] || ''}
                  onChange={e => setDiagMap(m => ({ ...m, [dim]: e.target.value || null }))}>
                  <option value="">— Ninguna —</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={saveDiag}>Guardar</button>
              <button className="btn btn-secondary" onClick={() => setShowDiag(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

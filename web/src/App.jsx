import React, { useEffect, useState } from 'react';

const defaultPageSize = 50;

export default function App() {
  const [options, setOptions] = useState({});
  const [mapping, setMapping] = useState({});
  const [columns, setColumns] = useState([]);
  const [filters, setFilters] = useState({ page: 1, page_size: defaultPageSize });
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(true);
  const [showDiag, setShowDiag] = useState(false);
  const [diagMap, setDiagMap] = useState({});

  useEffect(() => {
    fetch('/meta').then(r => r.json()).then(res => {
      setOptions(res.options);
      setMapping(res.mapping);
      setColumns(res.columns);
    });
  }, []);

  const buildParams = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (Array.isArray(v)) v.forEach(val => params.append(k, val));
      else if (v !== undefined && v !== '' && v !== false) params.append(k, v);
    });
    return params;
  };

  useEffect(() => {
    const params = buildParams();
    fetch('/bins?' + params.toString()).then(r => r.json()).then(res => {
      setData(res.data);
      setTotal(res.total);
    });
  }, [filters]);

  const updateFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const copyClipboard = () => {
    const lines = data.map(row => Object.values(row).join(','));
    navigator.clipboard.writeText(lines.join('\n'));
  };

  const activeFilters = Object.entries(filters).filter(([k, v]) => {
    if (['page', 'page_size'].includes(k)) return false;
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== '' && v !== false;
  }).length;

  const downloadUrl = '/bins/export?' + buildParams().toString();

  return (
    <div style={{ padding: '1rem' }}>
      <button onClick={() => setShowFilters(s => !s)}>
        Filtros {activeFilters > 0 && (<span style={{marginLeft:'0.5rem',background:'#eee',padding:'0 4px',borderRadius:'4px'}}>{activeFilters}</span>)}
      </button>
      <button onClick={() => { setDiagMap(mapping); setShowDiag(true); }}>Diagnóstico</button>
      {showFilters && (
        <div style={{ border: '1px solid #ccc', padding: '1rem', marginTop: '1rem' }}>
          <div>
            BIN prefix: <input value={filters.prefix || ''} onChange={e => updateFilter('prefix', e.target.value)} maxLength={8} />
          </div>
          {mapping.bank && options.bank && (
            <div>
              Banco incluir:
              <select multiple value={filters.include_bank || []} onChange={e => updateFilter('include_bank', Array.from(e.target.selectedOptions, o => o.value))}>
                {options.bank.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
          )}
          {mapping.bank && options.bank && (
            <div>
              Banco excluir:
              <select multiple value={filters.exclude_bank || []} onChange={e => updateFilter('exclude_bank', Array.from(e.target.selectedOptions, o => o.value))}>
                {options.bank.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
          )}
          {mapping.brand && options.brand && (
            <div>
              Marca:
              <select multiple value={filters.include_brand || []} onChange={e => updateFilter('include_brand', Array.from(e.target.selectedOptions, o => o.value))}>
                {options.brand.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
          )}
          {mapping.type && options.type && (
            <div>
              Tipo:
              <select multiple value={filters.include_type || []} onChange={e => updateFilter('include_type', Array.from(e.target.selectedOptions, o => o.value))}>
                {options.type.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
          )}
          {mapping.level && options.level && (
            <div>
              Nivel incluir:
              <select multiple value={filters.include_level || []} onChange={e => updateFilter('include_level', Array.from(e.target.selectedOptions, o => o.value))}>
                {options.level.map(b => <option key={b}>{b}</option>)}
              </select>
              Nivel excluir:
              <select multiple value={filters.exclude_level || []} onChange={e => updateFilter('exclude_level', Array.from(e.target.selectedOptions, o => o.value))}>
                {options.level.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
          )}
          {mapping.country && options.country && (
            <div>
              País:
              <select multiple value={filters.include_country || []} onChange={e => updateFilter('include_country', Array.from(e.target.selectedOptions, o => o.value))}>
                {options.country.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
          )}
          {mapping.country_code && options.country_code && (
            <div>
              Código ISO:
              <select multiple value={filters.include_country_code || []} onChange={e => updateFilter('include_country_code', Array.from(e.target.selectedOptions, o => o.value))}>
                {options.country_code.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
          )}
          {mapping.prepaid && options.prepaid && (
            <div>
              Prepago:
              <select value={filters.prepaid || ''} onChange={e => updateFilter('prepaid', e.target.value)}>
                <option value=''>Cualquiera</option>
                <option value='true'>Sí</option>
                <option value='false'>No</option>
              </select>
            </div>
          )}
          <div>
            Texto libre: <input value={filters.text || ''} onChange={e => updateFilter('text', e.target.value)} />
          </div>
          <div>
            <label><input type="checkbox" checked={filters.dedupe || false} onChange={e => updateFilter('dedupe', e.target.checked)} /> Deduplicar</label>
          </div>
          <div>
            Columnas a mostrar:
            <select multiple value={filters.columns || []} onChange={e => updateFilter('columns', Array.from(e.target.selectedOptions, o => o.value))}>
              {columns.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
      )}
      <div style={{ marginTop: '1rem' }}>
        <button onClick={copyClipboard}>Copiar visibles</button>
        <a href={downloadUrl} style={{marginLeft:'0.5rem'}}>Descargar CSV</a>
        <table border="1" cellPadding="4" style={{ width: '100%', marginTop: '0.5rem' }}>
          <thead>
            {data[0] && <tr>{Object.keys(data[0]).map(k => <th key={k}>{k}</th>)}</tr>}
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i}>{Object.values(row).map((v, j) => <td key={j}>{v}</td>)}</tr>
            ))}
          </tbody>
        </table>
        <div>Filas {data.length} de {total}</div>
        <button disabled={(filters.page || 1) <= 1} onClick={() => updateFilter('page', (filters.page || 1) - 1)}>Prev</button>
        <button disabled={(filters.page || 1) * (filters.page_size || defaultPageSize) >= total} onClick={() => updateFilter('page', (filters.page || 1) + 1)}>Next</button>
      </div>
      {showDiag && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)' }} onClick={() => setShowDiag(false)}>
          <div style={{ background: '#fff', margin: '10% auto', padding: '1rem', width: '320px' }} onClick={e => e.stopPropagation()}>
            <h3>Diagnóstico</h3>
            {Object.keys(mapping).map(dim => (
              <div key={dim}>
                {dim}: 
                <select value={diagMap[dim] || ''} onChange={e => setDiagMap(m => ({...m, [dim]: e.target.value || null}))}>
                  <option value=''>None</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            ))}
            <button onClick={() => {
              fetch('/mapping', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(diagMap)})
                .then(() => fetch('/meta').then(r => r.json()).then(res => {
                  setOptions(res.options);
                  setMapping(res.mapping);
                  setColumns(res.columns);
                  setFilters({ page:1, page_size: defaultPageSize });
                  setShowDiag(false);
                }));
            }}>Guardar</button>
            <button onClick={() => setShowDiag(false)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb.jsx';
import { getCatalogSchemas, searchColumns } from '../api/client.js';

export default function CatalogSchemasPage() {
  const [searchParams] = useSearchParams();
  const [schemas, setSchemas] = useState([]);
  const [search, setSearch] = useState('');
  const [columnSearch, setColumnSearch] = useState('');
  const [columnResults, setColumnResults] = useState([]);
  const [columnSearchLoading, setColumnSearchLoading] = useState(false);
  const [error, setError] = useState(null);

  const filterParam = searchParams.get('filter');
  const filter = filterParam ? filterParam.split(',').filter(Boolean) : null;

  useEffect(() => {
    getCatalogSchemas(filter).then(setSchemas).catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterParam]);

  useEffect(() => {
    const term = columnSearch.trim();
    if (!term) {
      setColumnResults([]);
      return undefined;
    }
    setColumnSearchLoading(true);
    const timeoutId = setTimeout(() => {
      searchColumns(term, filter)
        .then(setColumnResults)
        .catch((err) => setError(err.message))
        .finally(() => setColumnSearchLoading(false));
    }, 300);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnSearch, filterParam]);

  if (error) return <p className="text-red-600">Erro ao carregar catálogo: {error}</p>;

  const visible = schemas.filter((s) => s.schema.toLowerCase().includes(search.toLowerCase()));
  const isSearchingColumns = columnSearch.trim().length > 0;

  return (
    <div>
      <Breadcrumb items={[{ label: 'Catálogo' }]} />
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Catálogo de Dados</h1>
      <p className="text-sm text-slate-500 mb-4">Schemas e tabelas catalogados a partir do DB2</p>

      <div className="flex gap-3 flex-wrap mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar schema..."
          className="flex-1 min-w-[220px] max-w-sm border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
        />
        <input
          type="text"
          value={columnSearch}
          onChange={(e) => setColumnSearch(e.target.value)}
          placeholder="Buscar coluna em todas as tabelas..."
          className="flex-1 min-w-[220px] max-w-sm border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
        />
      </div>

      {isSearchingColumns ? (
        <div>
          {columnSearchLoading && <p className="text-sm text-slate-400 mb-2">Buscando...</p>}
          {!columnSearchLoading && columnResults.length === 0 && (
            <p className="text-sm text-slate-400">Nenhuma coluna encontrada para "{columnSearch}"</p>
          )}
          {!columnSearchLoading && columnResults.length === 200 && (
            <p className="text-xs text-slate-400 mb-2">
              Mostrando os primeiros 200 resultados — refine sua busca para ver menos itens.
            </p>
          )}
          <div className="space-y-2">
            {columnResults.map((r) => (
              <Link
                key={`${r.schema}.${r.table}.${r.column}`}
                to={`/catalogo/${r.schema}/${r.table}`}
                className="flex items-center justify-between border border-slate-200 rounded-xl p-3 shadow-sm hover:border-indigo-400 hover:shadow-md transition-shadow"
              >
                <div>
                  <div className="font-medium text-slate-800">{r.column}</div>
                  <div className="text-sm text-slate-500">
                    {r.schema}.{r.table} · {r.description || 'Sem descrição cadastrada'}
                  </div>
                </div>
                <span className="text-xs text-slate-400">{r.type}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map((s) => (
            <Link
              key={s.schema}
              to={`/catalogo/${s.schema}`}
              className="border border-slate-200 rounded-xl p-3 shadow-sm hover:border-indigo-400 hover:shadow-md transition-shadow"
            >
              <div className="font-semibold text-indigo-700">{s.schema}</div>
              <div className="text-sm text-slate-500">
                {s.tableCount} tabelas · {s.viewCount} views · {s.camada} · {s.dominio.name}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

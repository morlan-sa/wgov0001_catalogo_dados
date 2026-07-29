import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb.jsx';
import { getCatalogSchemas, getCatalogTables } from '../api/client.js';

export default function DomainDetailPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [schemas, setSchemas] = useState(null);
  const [tablesBySchema, setTablesBySchema] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getCatalogSchemas(null)
      .then((all) => {
        const matching = all.filter((s) => s.dominio.code === code);
        if (cancelled) return;
        setSchemas(matching);
        return Promise.all(
          matching.map((s) => getCatalogTables(s.schema).then((tables) => ({ schema: s.schema, tables })))
        );
      })
      .then((results) => {
        if (cancelled || !results) return;
        const map = {};
        results.forEach(({ schema, tables }) => {
          map[schema] = tables;
        });
        setTablesBySchema(map);
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) return <p className="text-red-600">Erro ao carregar domínio: {error}</p>;
  if (!schemas) return <p className="text-slate-500">Carregando...</p>;

  const domainName = schemas[0]?.dominio.name ?? code;

  function handleSelectTable(schema, tableName) {
    if (tableName) navigate(`/catalogo/${schema}/${tableName}`);
  }

  return (
    <div>
      <Breadcrumb items={[{ label: 'Domínios', to: '/dominios' }, { label: domainName }]} />
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-2xl font-bold text-slate-800">{domainName}</h1>
        <span className="inline-flex items-center justify-center min-w-[3rem] px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-100 text-indigo-700">
          {code}
        </span>
      </div>
      <p className="text-sm text-slate-500 mb-4">Schemas do DB2 que usam este domínio de negócio</p>

      {schemas.length === 0 ? (
        <p className="text-slate-400 text-sm">Nenhum schema usa este domínio ainda.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {schemas.map((s) => {
            const tables = tablesBySchema[s.schema];
            return (
              <div key={s.schema} className="border border-slate-200 rounded-xl p-3 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <Link to={`/catalogo/${s.schema}`} className="font-semibold text-indigo-700 hover:underline">
                    {s.schema}
                  </Link>
                  <span className="text-xs text-slate-400">
                    {s.tableCount} tabelas · {s.viewCount} views
                  </span>
                </div>
                <select
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-600"
                  value=""
                  onChange={(e) => handleSelectTable(s.schema, e.target.value)}
                  disabled={!tables || tables.length === 0}
                >
                  <option value="" disabled>
                    {!tables
                      ? 'Carregando tabelas...'
                      : tables.length === 0
                        ? 'Sem tabelas catalogadas'
                        : 'Selecione uma tabela...'}
                  </option>
                  {tables?.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name} ({t.type})
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb.jsx';
import { getCatalogSchemas } from '../api/client.js';

export default function CatalogSchemasPage() {
  const [searchParams] = useSearchParams();
  const [schemas, setSchemas] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);

  const filterParam = searchParams.get('filter');

  useEffect(() => {
    const filter = filterParam ? filterParam.split(',').filter(Boolean) : null;
    getCatalogSchemas(filter).then(setSchemas).catch((err) => setError(err.message));
  }, [filterParam]);

  if (error) return <p className="text-red-600">Erro ao carregar catálogo: {error}</p>;

  const visible = schemas.filter((s) => s.schema.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <Breadcrumb items={[{ label: 'Catálogo' }]} />
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Catálogo de Dados</h1>
      <p className="text-sm text-slate-500 mb-4">Schemas e tabelas catalogados a partir do DB2</p>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar schema..."
        className="w-full max-w-sm border border-slate-200 rounded-md px-3 py-1.5 text-sm mb-4"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visible.map((s) => (
          <Link
            key={s.schema}
            to={`/catalogo/${s.schema}`}
            className="border border-slate-200 rounded-xl p-3 shadow-sm hover:border-indigo-400 hover:shadow-md transition-shadow"
          >
            <div className="font-semibold text-indigo-700">{s.schema}</div>
            <div className="text-sm text-slate-500">
              {s.tableCount} tabelas · {s.camada} · {s.dominio.name}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

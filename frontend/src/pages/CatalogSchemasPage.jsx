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
      <h1 className="text-xl font-bold text-slate-800 mb-4">Catálogo de Dados</h1>
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
            className="border border-slate-200 rounded-lg p-3 hover:border-[#2C6B9E] hover:shadow-sm"
          >
            <div className="font-semibold text-[#1A3A5C]">{s.schema}</div>
            <div className="text-sm text-slate-500">
              {s.tableCount} tabelas · {s.camada} · {s.dominio.name}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

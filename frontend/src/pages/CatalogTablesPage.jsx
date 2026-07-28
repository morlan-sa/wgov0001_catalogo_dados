import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb.jsx';
import Badge from '../components/Badge.jsx';
import { getCatalogTables } from '../api/client.js';

export default function CatalogTablesPage() {
  const { schema } = useParams();
  const [tables, setTables] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    getCatalogTables(schema).then(setTables).catch((err) => setError(err.message));
  }, [schema]);

  if (error) return <p className="text-red-600">Erro ao carregar tabelas: {error}</p>;

  return (
    <div>
      <Breadcrumb items={[{ label: 'Catálogo', to: '/catalogo' }, { label: schema }]} />
      <h1 className="text-2xl font-bold text-slate-800 mb-4">{schema}</h1>
      <div className="space-y-2">
        {tables.map((t) => (
          <Link
            key={t.name}
            to={`/catalogo/${schema}/${t.name}`}
            className="flex items-center justify-between border border-slate-200 rounded-lg p-3 shadow-sm hover:border-blue-400 hover:shadow-md transition-shadow"
          >
            <div>
              <div className="font-medium text-slate-800">{t.name}</div>
              <div className="text-sm text-slate-500">{t.description || 'Sem descrição cadastrada'}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{t.type}</span>
              <Badge>{t.classification}</Badge>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

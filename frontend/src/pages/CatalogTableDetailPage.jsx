import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb.jsx';
import Badge from '../components/Badge.jsx';
import { getCatalogTableDetail } from '../api/client.js';

export default function CatalogTableDetailPage() {
  const { schema, table } = useParams();
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getCatalogTableDetail(schema, table).then(setDetail).catch((err) => setError(err.message));
  }, [schema, table]);

  if (error) return <p className="text-red-600">Erro ao carregar tabela: {error}</p>;
  if (!detail) return <p className="text-slate-500">Carregando...</p>;

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Catálogo', to: '/catalogo' },
          { label: schema, to: `/catalogo/${schema}` },
          { label: table },
        ]}
      />
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-2xl font-bold text-slate-800">
          {schema}.{table}
        </h1>
        <Badge>{detail.classification}</Badge>
      </div>
      <p className="text-sm text-slate-500 mb-1">{detail.description || 'Sem descrição cadastrada'}</p>
      <p className="text-xs text-slate-400 mb-4">
        {detail.totalRegistros.toLocaleString('pt-BR')} registro(s)
      </p>
      <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
        <thead className="bg-slate-50 text-slate-500 text-left">
          <tr>
            <th className="px-3 py-2">Coluna</th>
            <th className="px-3 py-2">Tipo</th>
            <th className="px-3 py-2">Domínio</th>
            <th className="px-3 py-2">Nulo</th>
            <th className="px-3 py-2">PK</th>
            <th className="px-3 py-2">Completude</th>
            <th className="px-3 py-2">Descrição</th>
          </tr>
        </thead>
        <tbody>
          {detail.columns.map((c) => (
            <tr key={c.name} className="border-t border-slate-100">
              <td className="px-3 py-2 font-medium">{c.name}</td>
              <td className="px-3 py-2 text-slate-500">
                {c.type}
                {c.length ? `(${c.length}${c.scale ? `,${c.scale}` : ''})` : ''}
              </td>
              <td className="px-3 py-2">
                <Badge>{c.domain}</Badge>
              </td>
              <td className="px-3 py-2">{c.nullable ? 'Sim' : 'Não'}</td>
              <td className="px-3 py-2">{c.isPrimaryKey ? '🔑' : ''}</td>
              <td className="px-3 py-2">
                {c.completude ? (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600">{c.completude.percentual}%</span>
                    <Badge>{c.completude.classificacao}</Badge>
                  </div>
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </td>
              <td className="px-3 py-2 text-slate-500">{c.description || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

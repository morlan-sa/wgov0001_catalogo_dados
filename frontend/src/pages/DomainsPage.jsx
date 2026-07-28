import { useEffect, useState } from 'react';
import Breadcrumb from '../components/Breadcrumb.jsx';
import { getDomains } from '../api/client.js';

export default function DomainsPage() {
  const [domains, setDomains] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDomains().then(setDomains).catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="text-red-600">Erro ao carregar domínios: {error}</p>;
  if (!domains) return <p className="text-slate-500">Carregando...</p>;

  return (
    <div>
      <Breadcrumb items={[{ label: 'Domínios' }]} />
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Domínios de Negócio</h1>
      <p className="text-sm text-slate-500 mb-4">
        Catálogo corporativo de domínios de negócio, com quantos schemas e objetos do DB2 já usam cada um
      </p>
      <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
        <thead className="bg-slate-50 text-slate-500 text-left">
          <tr>
            <th className="px-3 py-2">Código</th>
            <th className="px-3 py-2">Domínio</th>
            <th className="px-3 py-2">Schemas no DB2</th>
            <th className="px-3 py-2">Tabelas/Views</th>
          </tr>
        </thead>
        <tbody>
          {domains.map((d) => (
            <tr key={d.code} className="border-t border-slate-100">
              <td className="px-3 py-2 font-mono text-xs text-indigo-700">{d.code}</td>
              <td className="px-3 py-2 font-medium text-slate-800">{d.name}</td>
              <td className={`px-3 py-2 ${d.schemaCount === 0 ? 'text-slate-300' : 'text-slate-600'}`}>
                {d.schemaCount}
              </td>
              <td className={`px-3 py-2 ${d.objectCount === 0 ? 'text-slate-300' : 'text-slate-600'}`}>
                {d.objectCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

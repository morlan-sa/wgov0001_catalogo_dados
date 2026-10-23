import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {domains.map((d) => {
          const emUso = d.schemaCount > 0;
          const Wrapper = emUso ? Link : 'div';
          const wrapperProps = emUso ? { to: `/dominios/${d.code}` } : {};
          return (
            <Wrapper
              key={d.code}
              {...wrapperProps}
              className={`border rounded-xl p-3 shadow-sm transition-shadow ${
                emUso ? 'border-slate-200 hover:shadow-md hover:border-indigo-400' : 'border-slate-100'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`inline-flex items-center justify-center min-w-[3rem] px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                    emUso ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {d.code}
                </span>
                <div className={`font-semibold ${emUso ? 'text-indigo-700' : 'text-slate-400'}`}>{d.name}</div>
              </div>
              <div className={`text-sm ${emUso ? 'text-slate-500' : 'text-slate-300'}`}>
                {d.schemaCount} schema(s) · {d.objectCount} tabela(s)/view(s)
              </div>
            </Wrapper>
          );
        })}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb.jsx';
import Badge from '../components/Badge.jsx';
import { getCatalogTables, getTableSaude } from '../api/client.js';

const TIPO_LABEL = { T: 'Tabela', V: 'View' };
const CONCURRENCY = 6;

export default function CatalogTablesPage() {
  const { schema } = useParams();
  const [searchParams] = useSearchParams();
  const [tables, setTables] = useState([]);
  const [saudeByTable, setSaudeByTable] = useState({});
  const [error, setError] = useState(null);

  const tipo = searchParams.get('tipo'); // 'T' | 'V' | null (ambos)
  const tipoQuery = tipo ? `?tipo=${tipo}` : '';

  useEffect(() => {
    setSaudeByTable({});
    getCatalogTables(schema).then(setTables).catch((err) => setError(err.message));
  }, [schema]);

  // Busca a saúde de cada tabela em segundo plano, com um limite de requisições
  // simultâneas (schemas legados podem ter centenas de tabelas - buscar tudo de
  // uma vez sobrecarregaria o DB2 com muitas varreduras de COUNT(*) ao mesmo tempo).
  useEffect(() => {
    if (tables.length === 0) return undefined;
    let cancelled = false;
    let index = 0;

    async function worker() {
      while (!cancelled && index < tables.length) {
        const current = tables[index++];
        try {
          const result = await getTableSaude(schema, current.name);
          if (!cancelled) {
            setSaudeByTable((prev) => ({ ...prev, [current.name]: result }));
          }
        } catch {
          if (!cancelled) {
            setSaudeByTable((prev) => ({ ...prev, [current.name]: null }));
          }
        }
      }
    }

    const workers = Array.from({ length: Math.min(CONCURRENCY, tables.length) }, () => worker());
    Promise.all(workers);

    return () => {
      cancelled = true;
    };
  }, [schema, tables]);

  if (error) return <p className="text-red-600">Erro ao carregar tabelas: {error}</p>;

  const visible = tipo ? tables.filter((t) => t.type === TIPO_LABEL[tipo]) : tables;

  return (
    <div>
      <Breadcrumb items={[{ label: 'Catálogo', to: `/catalogo${tipoQuery}` }, { label: schema }]} />
      <h1 className="text-2xl font-bold text-slate-800 mb-4">
        {schema}
        {tipo && <span className="text-slate-400 font-normal"> · {TIPO_LABEL[tipo]}s</span>}
      </h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {visible.map((t) => {
          const saude = saudeByTable[t.name];
          return (
            <Link
              key={t.name}
              to={`/catalogo/${schema}/${t.name}`}
              className="border border-slate-200 rounded-lg p-2.5 shadow-sm hover:border-indigo-400 hover:shadow-md transition-shadow"
            >
              <div className="font-medium text-slate-800 text-sm truncate">{t.name}</div>
              <div className="text-xs text-slate-500 truncate">{t.description || 'Sem descrição cadastrada'}</div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs text-slate-400">{t.type}</span>
                <div className="flex items-center gap-1.5">
                  {saude === undefined && <span className="text-xs text-slate-300">calculando...</span>}
                  {saude === null && <span className="text-xs text-slate-300">saúde: -</span>}
                  {saude && (
                    <>
                      <span className="text-xs text-slate-500">{saude.saude.percentual}%</span>
                      <Badge>{saude.saude.classificacao}</Badge>
                    </>
                  )}
                  <Badge>{t.classification}</Badge>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

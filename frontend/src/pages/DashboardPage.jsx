import { useEffect, useState } from 'react';
import { Database, Table2, Eye, Layers } from 'lucide-react';
import StatCard from '../components/StatCard.jsx';
import Badge from '../components/Badge.jsx';
import { getDashboardSummary, getSchemas, getDashboardSaude } from '../api/client.js';

const CAMADA_TONE_CYCLE = ['purple', 'green', 'amber', 'sky'];

const BAR_COLOR = {
  Excelente: 'bg-emerald-500',
  Bom: 'bg-sky-500',
  Atenção: 'bg-red-500',
};

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [schemas, setSchemas] = useState(null);
  const [error, setError] = useState(null);
  const [saude, setSaude] = useState(null);
  const [saudeError, setSaudeError] = useState(null);

  useEffect(() => {
    Promise.all([getDashboardSummary(), getSchemas()])
      .then(([summaryData, schemasData]) => {
        setSummary(summaryData);
        setSchemas(schemasData);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    getDashboardSaude()
      .then(setSaude)
      .catch((err) => setSaudeError(err.message));
  }, []);

  if (error) return <p className="text-red-600">Erro ao carregar dashboard: {error}</p>;
  if (!summary || !schemas) return <p className="text-slate-500">Carregando...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800">Dashboard de Governança</h1>
      <p className="text-sm text-slate-500 mb-6">Visão geral do catálogo de dados do DB2</p>
      <div className="flex gap-4 mb-6 flex-wrap">
        <StatCard label="Schemas no DB2" value={summary.totalSchemas} icon={Database} tone="indigo" to="/catalogo" />
        <StatCard label="Tabelas" value={summary.totalTables} icon={Table2} tone="sky" to="/catalogo?tipo=T" />
        <StatCard label="Views" value={summary.totalViews} icon={Eye} tone="purple" to="/catalogo?tipo=V" />
      </div>

      <h2 className="text-sm font-semibold text-slate-600 mb-2">Tabelas por camada</h2>
      <div className="flex gap-4 mb-8 flex-wrap">
        {Object.entries(summary.porCamada).map(([camada, count], index) => {
          const schemasDaCamada = schemas.filter((s) => s.camada === camada).map((s) => s.schema);
          return (
            <StatCard
              key={camada}
              label={camada}
              value={count}
              icon={Layers}
              tone={CAMADA_TONE_CYCLE[index % CAMADA_TONE_CYCLE.length]}
              to={`/catalogo?filter=${schemasDaCamada.join(',')}`}
            />
          );
        })}
      </div>

      <h2 className="text-sm font-semibold text-slate-600 mb-2">Saúde por schema (governados)</h2>
      {saudeError && <p className="text-sm text-red-500">Erro ao calcular saúde: {saudeError}</p>}

      {!saude && !saudeError && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-3">
            Calculando saúde dos schemas STG/CUR/RPT (pode levar alguns segundos)...
          </p>
          <div className="space-y-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-24 h-3 bg-slate-100 rounded shrink-0" />
                <div className="flex-1 h-2.5 bg-slate-100 rounded-full" />
                <div className="w-10 h-3 bg-slate-100 rounded shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {saude && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-600">Média geral: {saude.percentual}%</span>
              <Badge>{saude.classificacao}</Badge>
            </div>
            <span className="text-xs text-slate-400">{saude.totalTabelasAvaliadas} tabelas avaliadas</span>
          </div>
          <div className="space-y-2.5">
            {saude.porSchema.map((s) => (
              <div key={s.schema} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs font-mono text-slate-600">{s.schema}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${BAR_COLOR[s.classificacao] || 'bg-slate-400'}`}
                    style={{ width: `${s.percentual}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-xs text-slate-500 text-right">{s.percentual}%</span>
                <span className="w-20 shrink-0 text-xs text-slate-400">{s.totalTabelas} tabela(s)</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Database, Table2, Eye, Layers, HeartPulse } from 'lucide-react';
import StatCard from '../components/StatCard.jsx';
import { getDashboardSummary, getSchemas, getDashboardSaude } from '../api/client.js';

const CAMADA_TONE_CYCLE = ['purple', 'green', 'amber', 'sky'];

const SAUDE_TONE = {
  Excelente: 'green',
  Bom: 'sky',
  Atenção: 'amber',
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
        <StatCard
          label="Saúde da Governança"
          value={saude ? `${saude.percentual}%` : saudeError ? '-' : '...'}
          subtitle={
            saude
              ? `${saude.classificacao} · ${saude.totalTabelasAvaliadas} tabelas governadas avaliadas`
              : saudeError
                ? 'Erro ao calcular'
                : 'Calculando (schemas STG/CUR/RPT)...'
          }
          icon={HeartPulse}
          tone={saude ? SAUDE_TONE[saude.classificacao] || 'indigo' : 'indigo'}
        />
      </div>
      <h2 className="text-sm font-semibold text-slate-600 mb-2">Tabelas por camada</h2>
      <div className="flex gap-4 flex-wrap">
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
    </div>
  );
}

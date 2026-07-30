import { useEffect, useState } from 'react';
import { Database, Table2, Eye, Layers } from 'lucide-react';
import StatCard from '../components/StatCard.jsx';
import Badge from '../components/Badge.jsx';
import SchemaHealthColumns from '../components/SchemaHealthColumns.jsx';
import {
  getDashboardSummary,
  getSchemas,
  getDashboardSaude,
  getDashboardSaudeLegado,
} from '../api/client.js';

const CAMADA_TONE_CYCLE = ['purple', 'green', 'amber', 'sky'];

function HealthChartSection({ title, description, data, error }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-slate-600 mb-1">{title}</h2>
      <p className="text-xs text-slate-400 mb-2">{description}</p>

      {error && <p className="text-sm text-red-500">Erro ao calcular: {error}</p>}

      {!data && !error && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-3">Calculando (pode levar alguns segundos)...</p>
          <div className="flex items-end gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 animate-pulse">
                <div className="w-7 bg-slate-100 rounded-t" style={{ height: 40 + (i % 3) * 25 }} />
                <div className="w-14 h-2 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      )}

      {data && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-600">Média geral: {data.percentual}%</span>
              <Badge>{data.classificacao}</Badge>
            </div>
            <span className="text-xs text-slate-400">{data.totalTabelasAvaliadas} tabelas avaliadas</span>
          </div>
          <SchemaHealthColumns data={data.porSchema} />
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [schemas, setSchemas] = useState(null);
  const [error, setError] = useState(null);

  const [saude, setSaude] = useState(null);
  const [saudeError, setSaudeError] = useState(null);

  const [saudeLegado, setSaudeLegado] = useState(null);
  const [saudeLegadoError, setSaudeLegadoError] = useState(null);

  useEffect(() => {
    Promise.all([getDashboardSummary(), getSchemas()])
      .then(([summaryData, schemasData]) => {
        setSummary(summaryData);
        setSchemas(schemasData);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    getDashboardSaude().then(setSaude).catch((err) => setSaudeError(err.message));
  }, []);

  useEffect(() => {
    getDashboardSaudeLegado().then(setSaudeLegado).catch((err) => setSaudeLegadoError(err.message));
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

      <HealthChartSection
        title="Saúde por schema — governados (STG/CUR/RPT)"
        description="% de preenchimento real dos dados (colunas de negócio, sem contar campos de auditoria)"
        data={saude}
        error={saudeError}
      />

      <HealthChartSection
        title="Saúde por schema — legado"
        description={`% de preenchimento real dos dados, igual ao gráfico acima — mas calculado sobre uma amostra das ${saudeLegado?.amostraPorSchema ?? 5} menores tabelas de cada schema (schemas legados podem ter tabelas com milhões de linhas)${saudeLegado?.schemasSemAcesso?.length ? `. ${saudeLegado.schemasSemAcesso.length} schema(s) sem tabela legível para este usuário não aparecem no gráfico.` : ''}`}
        data={saudeLegado}
        error={saudeLegadoError}
      />
    </div>
  );
}

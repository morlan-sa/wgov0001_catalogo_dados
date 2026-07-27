import { useEffect, useState } from 'react';
import StatCard from '../components/StatCard.jsx';
import { getDashboardSummary } from '../api/client.js';

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDashboardSummary().then(setSummary).catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="text-red-600">Erro ao carregar dashboard: {error}</p>;
  if (!summary) return <p className="text-slate-500">Carregando...</p>;

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">Dashboard</h1>
      <div className="flex gap-4 mb-6 flex-wrap">
        <StatCard label="Schemas no DB2" value={summary.totalSchemas} />
        <StatCard label="Tabelas/Views" value={summary.totalTables} />
      </div>
      <h2 className="text-sm font-semibold text-slate-600 mb-2">Tabelas por camada</h2>
      <div className="flex gap-4 flex-wrap">
        {Object.entries(summary.porCamada).map(([camada, count]) => (
          <StatCard key={camada} label={camada} value={count} />
        ))}
      </div>
    </div>
  );
}

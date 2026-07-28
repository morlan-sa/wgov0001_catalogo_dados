import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSchemas } from '../api/client.js';

const GOVERNADAS = ['STG', 'CUR', 'RPT'];

export default function ScannerPage() {
  const [schemas, setSchemas] = useState([]);
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [filterText, setFilterText] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    getSchemas().then(setSchemas).catch((err) => setError(err.message));
  }, []);

  function chooseShortcut(kind) {
    if (kind === 'governadas') {
      setSelected(new Set(schemas.filter((s) => GOVERNADAS.includes(s.camada)).map((s) => s.schema)));
    } else if (kind === 'todas') {
      setSelected(new Set(schemas.map((s) => s.schema)));
    } else {
      setSelected(new Set());
    }
    setStep(2);
  }

  function toggle(schema) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(schema)) {
        next.delete(schema);
      } else {
        next.add(schema);
      }
      return next;
    });
  }

  function runQuery() {
    navigate(`/catalogo?filter=${Array.from(selected).join(',')}`);
  }

  if (error) return <p className="text-red-600">Erro ao carregar schemas: {error}</p>;

  const visibleSchemas = schemas.filter((s) =>
    s.schema.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Scanner</h1>
      <p className="text-sm text-slate-500 mb-6">Escolha quais schemas do DB2 explorar no catálogo</p>

      {step === 1 && (
        <div className="space-y-3 max-w-md">
          <p className="text-sm text-slate-500 mb-2">Passo 1 de 2 — Escolha o grupo</p>
          <button
            onClick={() => chooseShortcut('governadas')}
            className="w-full text-left border border-slate-200 rounded-xl p-3 hover:border-indigo-400"
          >
            <div className="font-semibold text-indigo-700">Schemas governados</div>
            <div className="text-sm text-slate-500">STG_ / CUR_ / RPT_</div>
          </button>
          <button
            onClick={() => chooseShortcut('todas')}
            className="w-full text-left border border-slate-200 rounded-xl p-3 hover:border-indigo-400"
          >
            <div className="font-semibold">Todos os schemas</div>
            <div className="text-sm text-slate-500">{schemas.length} schemas</div>
          </button>
          <button
            onClick={() => chooseShortcut('manual')}
            className="w-full text-left border border-slate-200 rounded-xl p-3 hover:border-indigo-400"
          >
            <div className="font-semibold">Escolher manualmente</div>
            <div className="text-sm text-slate-500">Selecionar schema a schema</div>
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="max-w-md">
          <p className="text-sm text-slate-500 mb-2">Passo 2 de 2 — Confirme a seleção</p>
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filtrar schema"
            className="w-full border border-slate-200 rounded-md px-3 py-1.5 text-sm mb-2"
          />
          <div className="border border-slate-200 rounded-xl p-2 max-h-72 overflow-y-auto space-y-1">
            {visibleSchemas.map((s) => (
              <label key={s.schema} className="flex items-center gap-2 px-2 py-1 text-sm">
                <input type="checkbox" checked={selected.has(s.schema)} onChange={() => toggle(s.schema)} />
                <span className="font-medium">{s.schema}</span>
                <span className="text-slate-400 ml-auto">{s.tableCount} tabelas</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => setStep(1)} className="px-3 py-1.5 text-sm text-slate-600">
              Voltar
            </button>
            <button
              onClick={runQuery}
              disabled={selected.size === 0}
              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg disabled:opacity-40 hover:bg-indigo-700 transition-colors"
            >
              Consultar ({selected.size} schemas)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

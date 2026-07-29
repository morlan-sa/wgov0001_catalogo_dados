const BAR_COLOR = {
  Excelente: 'bg-emerald-500',
  Bom: 'bg-sky-500',
  Atenção: 'bg-red-500',
};

const MAX_BAR_HEIGHT = 120; // px

export default function SchemaHealthColumns({ data }) {
  return (
    <div className="flex items-end gap-3 overflow-x-auto pb-1">
      {data.map((s) => (
        <div
          key={s.schema}
          className="flex flex-col items-center shrink-0 w-16"
          title={`${s.schema}: ${s.percentual}% (${s.totalTabelas} tabela(s))`}
        >
          <span className="text-[11px] text-slate-500 mb-1">{s.percentual}%</span>
          <div className="flex items-end" style={{ height: MAX_BAR_HEIGHT }}>
            <div
              className={`w-7 rounded-t ${BAR_COLOR[s.classificacao] || 'bg-slate-300'}`}
              style={{ height: `${Math.max((s.percentual / 100) * MAX_BAR_HEIGHT, 4)}px` }}
            />
          </div>
          <span className="text-[10px] text-slate-400 mt-1.5 text-center leading-tight break-words w-16">
            {s.schema}
          </span>
        </div>
      ))}
    </div>
  );
}

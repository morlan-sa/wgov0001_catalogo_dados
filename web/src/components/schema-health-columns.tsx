import { Span } from "@morlan/ui"
import type { SchemaSaude } from "@/hooks/queries/dashboard"
import { barHeight, MAX_BAR_HEIGHT_PX } from "@/utils/chart"

// Gráfico de colunas verticais: uma por schema, altura proporcional ao
// percentual de preenchimento real dos dados. Não há componente de gráfico na
// `@morlan/ui` — é CSS puro sobre os tokens de cor da lib.
const BAR_COLOR: Record<string, string> = {
  Excelente: "bg-success-500",
  Bom: "bg-primary-500",
  Atenção: "bg-destructive-500",
}

export function SchemaHealthColumns({ data }: { data: SchemaSaude[] }) {
  return (
    <div className="flex items-end gap-3 overflow-x-auto pb-1">
      {data.map((s) => (
        <div
          key={s.schemaName}
          className="flex w-16 shrink-0 flex-col items-center"
          title={`${s.schemaName}: ${s.percentual}% (${s.totalTabelas} tabela(s))`}
        >
          <Span variant="small" className="mb-1">
            {s.percentual}%
          </Span>
          <div className="flex items-end" style={{ height: MAX_BAR_HEIGHT_PX }}>
            <div
              className={`w-7 rounded-t ${BAR_COLOR[s.classificacao] ?? "bg-muted"}`}
              style={{ height: `${barHeight(s.percentual)}px` }}
            />
          </div>
          <Span
            variant="small"
            className="mt-1.5 w-16 text-center leading-tight break-words"
          >
            {s.schemaName}
          </Span>
        </div>
      ))}
    </div>
  )
}

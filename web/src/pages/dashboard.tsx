import {
  Database01Icon,
  Layers01Icon,
  Table01Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons"
import { Card, H2, P, Skeleton, Span } from "@morlan/ui"
import { SchemaHealthColumns } from "@/components/schema-health-columns"
import { QueryError } from "@/components/query-feedback"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import {
  useDashboardSaude,
  useDashboardSaudeLegado,
  useDashboardSummary,
  type DashboardSaude,
} from "@/hooks/queries/dashboard"
import { useSchemas } from "@/hooks/queries/schemas"

interface HealthChartSectionProps {
  title: string
  description: string
  data: DashboardSaude | undefined
  error: unknown
  isPending: boolean
}

function HealthChartSection({
  title,
  description,
  data,
  error,
  isPending,
}: HealthChartSectionProps) {
  return (
    <section className="mb-8">
      <H2 className="mb-1 text-sm font-semibold text-muted-foreground">
        {title}
      </H2>
      <P className="mb-2 text-xs text-muted-foreground">{description}</P>

      {error != null && (
        <QueryError error={error} fallback="Erro ao calcular a saúde dos dados." />
      )}

      {isPending && (
        <Card className="p-4">
          <Span variant="small" className="mb-3">
            Calculando (pode levar alguns segundos)...
          </Span>
          <div className="flex items-end gap-3" aria-busy="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton
                key={i}
                className="w-7"
                style={{ height: 40 + (i % 3) * 25 }}
              />
            ))}
          </div>
        </Card>
      )}

      {data && (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Span>Média geral: {data.percentual}%</Span>
              <StatusBadge>{data.classificacao}</StatusBadge>
            </div>
            <Span variant="small">
              {data.totalTabelasAvaliadas} tabelas avaliadas
            </Span>
          </div>
          <SchemaHealthColumns data={data.porSchema} />
        </Card>
      )}
    </section>
  )
}

function legadoDescription(legado: DashboardSaude | undefined): string {
  const amostra = legado?.amostraPorSchema
  const semAcesso = legado?.schemasSemAcesso?.length ?? 0
  const base =
    "% de preenchimento real dos dados, igual ao gráfico acima — mas calculado sobre " +
    `uma amostra das ${amostra ?? "N"} menores tabelas de cada schema ` +
    "(schemas legados podem ter tabelas com milhões de linhas)"
  return semAcesso > 0
    ? `${base}. ${semAcesso} schema(s) sem tabela legível para este usuário não aparecem no gráfico.`
    : base
}

export function Dashboard() {
  const summary = useDashboardSummary()
  const schemas = useSchemas()
  const saude = useDashboardSaude()
  const legado = useDashboardSaudeLegado()

  if (summary.isError || schemas.isError) {
    return (
      <QueryError
        error={summary.error ?? schemas.error}
        fallback="Erro ao carregar o dashboard."
      />
    )
  }

  if (!summary.data || !schemas.data) {
    return (
      <div className="flex gap-4" aria-busy="true">
        <Skeleton className="h-24 flex-1" />
        <Skeleton className="h-24 flex-1" />
        <Skeleton className="h-24 flex-1" />
      </div>
    )
  }

  const { totalSchemas, totalTables, totalViews, porCamada } = summary.data

  return (
    <div>
      <P className="mb-6 text-sm text-muted-foreground">
        Visão geral do catálogo de dados
      </P>

      <div className="mb-6 flex flex-wrap gap-4">
        <StatCard
          label="Schemas no banco"
          value={totalSchemas}
          icon={Database01Icon}
          to="/catalogo"
        />
        <StatCard
          label="Tabelas"
          value={totalTables}
          icon={Table01Icon}
          to="/catalogo?tipo=T"
        />
        <StatCard
          label="Views"
          value={totalViews}
          icon={ViewIcon}
          to="/catalogo?tipo=V"
        />
      </div>

      <H2 className="mb-2 text-sm font-semibold text-muted-foreground">
        Tabelas por camada
      </H2>
      <div className="mb-8 flex flex-wrap gap-4">
        {Object.entries(porCamada).map(([camada, count]) => {
          const doSchema = schemas.data
            .filter((s) => s.camada === camada)
            .map((s) => s.schemaName)
          return (
            <StatCard
              key={camada}
              label={camada}
              value={count}
              icon={Layers01Icon}
              to={`/catalogo?filter=${doSchema.join(",")}`}
            />
          )
        })}
      </div>

      <HealthChartSection
        title="Saúde por schema — governados (STG/CUR/RPT)"
        description="% de preenchimento real dos dados (colunas de negócio, sem contar campos de auditoria)"
        data={saude.data}
        error={saude.error}
        isPending={saude.isPending}
      />

      <HealthChartSection
        title="Saúde por schema — legado"
        description={legadoDescription(legado.data)}
        data={legado.data}
        error={legado.error}
        isPending={legado.isPending}
      />
    </div>
  )
}

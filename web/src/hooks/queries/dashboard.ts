// Consome `server/app/features/dashboard/`. Tipo "raw" espelha o JSON do BFF
// (snake_case); o tipo local é camelCase — a conversão acontece aqui.
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"

interface SummaryRaw {
  total_schemas: number
  total_tables: number
  total_views: number
  por_camada: Record<string, number>
}

interface SchemaSaudeRaw {
  schema_name: string
  percentual: number
  classificacao: string
  total_tabelas: number
}

interface SaudeRaw {
  percentual: number
  classificacao: string
  total_tabelas_avaliadas: number
  por_schema: SchemaSaudeRaw[]
  amostra_por_schema?: number
  schemas_sem_acesso?: string[]
}

interface DashboardSummary {
  totalSchemas: number
  totalTables: number
  totalViews: number
  porCamada: Record<string, number>
}

export interface SchemaSaude {
  schemaName: string
  percentual: number
  classificacao: string
  totalTabelas: number
}

export interface DashboardSaude {
  percentual: number
  classificacao: string
  totalTabelasAvaliadas: number
  porSchema: SchemaSaude[]
  /** Só na saúde do legado: tamanho da amostra de tabelas por schema. */
  amostraPorSchema?: number
  /** Só na saúde do legado: schemas em que o usuário do banco não lê nada. */
  schemasSemAcesso?: string[]
}

export function mapSaude(raw: SaudeRaw): DashboardSaude {
  return {
    percentual: raw.percentual,
    classificacao: raw.classificacao,
    totalTabelasAvaliadas: raw.total_tabelas_avaliadas,
    porSchema: raw.por_schema.map((s) => ({
      schemaName: s.schema_name,
      percentual: s.percentual,
      classificacao: s.classificacao,
      totalTabelas: s.total_tabelas,
    })),
    amostraPorSchema: raw.amostra_por_schema,
    schemasSemAcesso: raw.schemas_sem_acesso,
  }
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: async () => {
      const raw = (await api.get("/dashboard/summary")).data as SummaryRaw
      return {
        totalSchemas: raw.total_schemas,
        totalTables: raw.total_tables,
        totalViews: raw.total_views,
        porCamada: raw.por_camada,
      } satisfies DashboardSummary
    },
  })
}

// As duas saúdes varrem dados reais no banco (segundos): sem refetch ao voltar
// para a aba e sem retry — falha de permissão/tempo não melhora tentando de novo.
export function useDashboardSaude() {
  return useQuery({
    queryKey: ["dashboard", "saude"],
    queryFn: async () => mapSaude((await api.get("/dashboard/saude")).data as SaudeRaw),
    refetchOnWindowFocus: false,
    retry: false,
  })
}

export function useDashboardSaudeLegado() {
  return useQuery({
    queryKey: ["dashboard", "saude-legado"],
    queryFn: async () =>
      mapSaude((await api.get("/dashboard/saude-legado")).data as SaudeRaw),
    refetchOnWindowFocus: false,
    retry: false,
  })
}

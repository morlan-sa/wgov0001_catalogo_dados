// Consome `server/app/features/catalog/`: tabelas, detalhe, saúde e busca de
// colunas. Tipo "raw" espelha o JSON do BFF (snake_case); o tipo local é
// camelCase — a conversão acontece aqui.
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"

interface SaudeRaw {
  percentual: number
  classificacao: string
}

interface TableRaw {
  name: string
  type: string
  description: string | null
  classification: string
}

interface ColumnRaw {
  name: string
  type: string
  length: number | null
  scale: number | null
  nullable: boolean
  order: number
  description: string | null
  is_primary_key: boolean
  domain: string
  completude: SaudeRaw | null
}

interface TableSaudeRaw {
  total_registros: number
  saude: SaudeRaw
}

interface TableDetailRaw extends TableRaw {
  schema_name: string
  // null quando o usuário do banco não lê os dados da tabela (leitura_negada).
  total_registros: number | null
  saude: SaudeRaw | null
  leitura_negada: boolean
  columns: ColumnRaw[]
}

interface ColumnSearchRaw {
  schema_name: string
  table: string
  column: string
  type: string
  description: string | null
}

interface Saude {
  percentual: number
  classificacao: string
}

export interface Table {
  name: string
  type: string
  description: string | null
  classification: string
}

export interface Column {
  name: string
  type: string
  length: number | null
  scale: number | null
  nullable: boolean
  order: number
  description: string | null
  isPrimaryKey: boolean
  domain: string
  completude: Saude | null
}

export interface TableSaude {
  totalRegistros: number
  saude: Saude
}

export interface TableDetail extends Table {
  schemaName: string
  totalRegistros: number | null
  saude: Saude | null
  /** Sem permissão de SELECT: a estrutura aparece, a saúde não. */
  leituraNegada: boolean
  columns: Column[]
}

export interface ColumnSearchResult {
  schemaName: string
  table: string
  column: string
  type: string
  description: string | null
}

function mapSaude(raw: SaudeRaw): Saude {
  return { percentual: raw.percentual, classificacao: raw.classificacao }
}

function mapTable(raw: TableRaw): Table {
  return {
    name: raw.name,
    type: raw.type,
    description: raw.description,
    classification: raw.classification,
  }
}

export function mapTableSaude(raw: TableSaudeRaw): TableSaude {
  return { totalRegistros: raw.total_registros, saude: mapSaude(raw.saude) }
}

export function mapTableDetail(raw: TableDetailRaw): TableDetail {
  return {
    ...mapTable(raw),
    totalRegistros: raw.total_registros,
    saude: raw.saude ? mapSaude(raw.saude) : null,
    leituraNegada: raw.leitura_negada,
    schemaName: raw.schema_name,
    columns: raw.columns.map((c) => ({
      name: c.name,
      type: c.type,
      length: c.length,
      scale: c.scale,
      nullable: c.nullable,
      order: c.order,
      description: c.description,
      isPrimaryKey: c.is_primary_key,
      domain: c.domain,
      completude: c.completude ? mapSaude(c.completude) : null,
    })),
  }
}

export function useCatalogTables(schema: string) {
  return useQuery({
    queryKey: ["catalog", "tables", schema],
    queryFn: async () => {
      const res = await api.get(`/catalog/schemas/${schema}/tables`)
      return (res.data as TableRaw[]).map(mapTable)
    },
  })
}

/**
 * Saúde (completude) de uma tabela — varre a tabela inteira no banco, então a
 * tela só pede a das linhas visíveis (paginadas). Sem retry: falha por
 * permissão não melhora tentando de novo.
 */
export function useTableSaude(schema: string, table: string) {
  return useQuery({
    queryKey: ["catalog", "saude", schema, table],
    queryFn: async () => {
      const res = await api.get(`/catalog/schemas/${schema}/tables/${table}/saude`)
      return mapTableSaude(res.data as TableSaudeRaw)
    },
    retry: false,
  })
}

export function useTableDetail(schema: string, table: string) {
  return useQuery({
    queryKey: ["catalog", "detail", schema, table],
    queryFn: async () => {
      const res = await api.get(`/catalog/schemas/${schema}/tables/${table}`)
      return mapTableDetail(res.data as TableDetailRaw)
    },
  })
}

/** Busca de coluna em todas as tabelas; só dispara com um termo não vazio. */
export function useColumnSearch(term: string, filter: string[] | null) {
  const trimmed = term.trim()
  const filterKey = filter?.join(",") ?? ""
  return useQuery({
    queryKey: ["catalog", "columns-search", trimmed, filterKey],
    queryFn: async () => {
      const res = await api.get("/catalog/columns/search", {
        params: { q: trimmed, ...(filterKey ? { filter: filterKey } : {}) },
      })
      return (res.data as ColumnSearchRaw[]).map(
        (r): ColumnSearchResult => ({
          schemaName: r.schema_name,
          table: r.table,
          column: r.column,
          type: r.type,
          description: r.description,
        })
      )
    },
    enabled: trimmed.length > 0,
  })
}

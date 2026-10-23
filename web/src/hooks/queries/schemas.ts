// Consome `server/app/features/schemas/` e `catalog/schemas` (lista de schemas
// do banco com camada e domínio de negócio inferidos). Tipo "raw" espelha o JSON
// do BFF (snake_case); o tipo local é camelCase — a conversão acontece aqui.
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"

interface DominioRaw {
  code: string
  name: string
}

interface SchemaRaw {
  schema_name: string
  table_count: number
  view_count: number
  camada: string
  dominio: DominioRaw
}

interface Dominio {
  code: string
  name: string
}

export interface Schema {
  schemaName: string
  tableCount: number
  viewCount: number
  camada: string
  dominio: Dominio
}

export function mapSchema(raw: SchemaRaw): Schema {
  return {
    schemaName: raw.schema_name,
    tableCount: raw.table_count,
    viewCount: raw.view_count,
    camada: raw.camada,
    dominio: { code: raw.dominio.code, name: raw.dominio.name },
  }
}

/** Todos os schemas do banco (usado pelo Scanner e pelo Dashboard). */
export function useSchemas() {
  return useQuery({
    queryKey: ["schemas"],
    queryFn: async () => {
      const res = await api.get("/schemas")
      return (res.data as SchemaRaw[]).map(mapSchema)
    },
  })
}

/** Schemas do catálogo, opcionalmente restritos a uma seleção (`?filter=A,B`). */
export function useCatalogSchemas(filter: string[] | null) {
  const filterKey = filter?.join(",") ?? ""
  return useQuery({
    queryKey: ["catalog", "schemas", filterKey],
    queryFn: async () => {
      const res = await api.get("/catalog/schemas", {
        params: filterKey ? { filter: filterKey } : undefined,
      })
      return (res.data as SchemaRaw[]).map(mapSchema)
    },
  })
}

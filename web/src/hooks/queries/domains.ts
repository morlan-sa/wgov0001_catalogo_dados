// Consome `server/app/features/domains/`: os 24 domínios de negócio e quantos
// schemas/objetos do banco usam cada um. Tipo "raw" espelha o JSON do BFF
// (snake_case); o tipo local é camelCase.
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"

interface DomainRaw {
  code: string
  name: string
  schema_count: number
  object_count: number
}

export interface Domain {
  code: string
  name: string
  schemaCount: number
  objectCount: number
}

export function useDomains() {
  return useQuery({
    queryKey: ["domains"],
    queryFn: async () => {
      const res = await api.get("/domains")
      return (res.data as DomainRaw[]).map(
        (d): Domain => ({
          code: d.code,
          name: d.name,
          schemaCount: d.schema_count,
          objectCount: d.object_count,
        })
      )
    },
  })
}

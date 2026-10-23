import type { Column, Table } from "@/hooks/queries/catalog"
import type { Schema } from "@/hooks/queries/schemas"

export const TIPO_LABEL: Record<string, string> = { T: "Tabela", V: "View" }

export type Atalho = "governadas" | "todas" | "manual"

export function filterSchemas(
  schemas: Schema[],
  search: string,
  tipo: string | null
): Schema[] {
  const term = search.toLowerCase()
  return schemas
    .filter((s) => s.schemaName.toLowerCase().includes(term))
    .filter((s) => {
      if (tipo === "T") return s.tableCount > 0
      if (tipo === "V") return s.viewCount > 0
      return true
    })
}

export function filterTables(
  tables: Table[],
  search: string,
  tipo: string | null
): Table[] {
  const term = search.toLowerCase()
  return tables
    .filter((t) => (tipo ? t.type === TIPO_LABEL[tipo] : true))
    .filter(
      (t) =>
        t.name.toLowerCase().includes(term) ||
        (t.description ?? "").toLowerCase().includes(term)
    )
}

export function columnType(c: Pick<Column, "type" | "length" | "scale">): string {
  if (!c.length) return c.type
  return `${c.type}(${c.length}${c.scale ? `,${c.scale}` : ""})`
}

/** Seleção inicial de cada atalho do Scanner. "Governados" = tudo que não é LEGADO. */
export function schemasDoAtalho(atalho: Atalho, schemas: Schema[]): Set<string> {
  if (atalho === "governadas") {
    return new Set(
      schemas.filter((s) => s.camada !== "LEGADO").map((s) => s.schemaName)
    )
  }
  if (atalho === "todas") return new Set(schemas.map((s) => s.schemaName))
  return new Set()
}

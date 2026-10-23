import type { Column, Table } from "@/hooks/queries/catalog"
import type { Conformidade } from "@/hooks/queries/nomenclatura"
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

/**
 * Soma a conformidade das tabelas onde ela se aplica (LEGADO fica de fora).
 * Mesmo peso do backend: conforme 1, aviso 0,5, fora 0; arredonda .5 para cima.
 */
export function somarConformidade(tables: Table[]): Conformidade {
  const soma = { conformes: 0, avisos: 0, fora: 0, total: 0 }
  let aplicavel = false
  for (const t of tables) {
    const c = t.conformidade
    if (!c?.aplicavel) continue
    aplicavel = true
    soma.conformes += c.conformes
    soma.avisos += c.avisos
    soma.fora += c.fora
    soma.total += c.total
  }
  const percentual =
    soma.total > 0
      ? Math.floor(((soma.conformes + 0.5 * soma.avisos) / soma.total) * 100 + 0.5)
      : null
  return { aplicavel, ...soma, percentual }
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

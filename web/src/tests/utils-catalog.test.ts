import { describe, expect, it } from "vitest"
import type { Table } from "@/hooks/queries/catalog"
import type { Conformidade } from "@/hooks/queries/nomenclatura"
import type { Schema } from "@/hooks/queries/schemas"
import { barHeight } from "@/utils/chart"
import {
  columnType,
  filterSchemas,
  filterTables,
  schemasDoAtalho,
  somarConformidade,
} from "@/utils/catalog"
import { statusVariant } from "@/utils/status"

const schema = (
  schemaName: string,
  tableCount: number,
  viewCount: number,
  camada: string
): Schema => ({
  schemaName,
  tableCount,
  viewCount,
  camada,
  dominio: { code: "NC", name: "Não classificado" },
})

const SCHEMAS = [
  schema("CUR_COM", 1, 0, "CUR"),
  schema("RPT_COM", 2, 1, "RPT"),
  schema("COMPRAS", 428, 10, "LEGADO"),
  schema("SO_VIEWS", 0, 3, "LEGADO"),
]

describe("filterSchemas", () => {
  it("busca por parte do nome, sem diferenciar caixa", () => {
    expect(filterSchemas(SCHEMAS, "com", null).map((s) => s.schemaName)).toEqual([
      "CUR_COM",
      "RPT_COM",
      "COMPRAS",
    ])
  })

  it("tipo T mantém só quem tem tabelas; V só quem tem views", () => {
    expect(filterSchemas(SCHEMAS, "", "T").map((s) => s.schemaName)).not.toContain(
      "SO_VIEWS"
    )
    expect(filterSchemas(SCHEMAS, "", "V").map((s) => s.schemaName)).toEqual([
      "RPT_COM",
      "COMPRAS",
      "SO_VIEWS",
    ])
  })
})

describe("filterTables", () => {
  const tables: Table[] = [
    { name: "IMPORTADOR", type: "Tabela", description: "Dado sensível", classification: "Restrito", conformidade: null },
    { name: "V_IMP", type: "View", description: null, classification: "Não classificado", conformidade: null },
  ]

  it("busca no nome e na descrição", () => {
    expect(filterTables(tables, "sensível", null)).toHaveLength(1)
    expect(filterTables(tables, "v_imp", null)[0].name).toBe("V_IMP")
  })

  it("filtra por tipo", () => {
    expect(filterTables(tables, "", "V").map((t) => t.name)).toEqual(["V_IMP"])
    expect(filterTables(tables, "", "T").map((t) => t.name)).toEqual(["IMPORTADOR"])
  })
})

describe("columnType", () => {
  it("mostra tamanho e escala quando existem", () => {
    expect(columnType({ type: "DECIMAL", length: 15, scale: 2 })).toBe("DECIMAL(15,2)")
    expect(columnType({ type: "VARCHAR", length: 3, scale: 0 })).toBe("VARCHAR(3)")
    expect(columnType({ type: "DATE", length: null, scale: null })).toBe("DATE")
  })
})

describe("schemasDoAtalho", () => {
  it("governados = tudo que não é legado", () => {
    expect([...schemasDoAtalho("governadas", SCHEMAS)]).toEqual(["CUR_COM", "RPT_COM"])
  })

  it("todos e manual", () => {
    expect(schemasDoAtalho("todas", SCHEMAS).size).toBe(4)
    expect(schemasDoAtalho("manual", SCHEMAS).size).toBe(0)
  })
})

describe("somarConformidade", () => {
  const conf = (
    aplicavel: boolean,
    conformes: number,
    avisos: number,
    fora: number
  ): Conformidade => ({
    aplicavel,
    conformes,
    avisos,
    fora,
    total: conformes + avisos + fora,
    percentual: null,
  })
  const tabela = (name: string, conformidade: Conformidade | null): Table => ({
    name,
    type: "Tabela",
    description: null,
    classification: "Não classificado",
    conformidade,
  })

  it("soma as tabelas aplicáveis e ignora a não aplicável", () => {
    const r = somarConformidade([
      tabela("A", conf(true, 3, 1, 0)),
      tabela("B", conf(true, 1, 0, 3)),
      tabela("LEG", conf(false, 0, 0, 0)),
      tabela("SEM", null),
    ])
    expect(r).toEqual({
      aplicavel: true,
      conformes: 4,
      avisos: 1,
      fora: 3,
      total: 8,
      percentual: 56, // (4 + 0,5) / 8 = 56,25 %
    })
  })

  it("arredonda .5 para cima, como o backend", () => {
    // 1 / 8 = 12,5 % -> 13
    expect(somarConformidade([tabela("A", conf(true, 1, 0, 7))]).percentual).toBe(13)
  })

  it("sem nenhuma tabela aplicável: não aplicável, zeros e percentual nulo", () => {
    expect(somarConformidade([tabela("LEG", conf(false, 0, 0, 0))])).toEqual({
      aplicavel: false,
      conformes: 0,
      avisos: 0,
      fora: 0,
      total: 0,
      percentual: null,
    })
  })

  it("aplicável mas sem colunas: percentual nulo", () => {
    expect(somarConformidade([tabela("A", conf(true, 0, 0, 0))]).percentual).toBeNull()
  })
})

describe("gráfico e selos", () => {
  it("altura proporcional, com mínimo visível", () => {
    expect(barHeight(100)).toBe(120)
    expect(barHeight(50)).toBe(60)
    expect(barHeight(0)).toBe(4)
  })

  it("variante do selo por classificação/completude", () => {
    expect(statusVariant("Sigiloso")).toBe("destructive")
    expect(statusVariant("Restrito")).toBe("warning")
    expect(statusVariant("Excelente")).toBe("success")
    expect(statusVariant("Atenção")).toBe("destructive")
    expect(statusVariant("qualquer outro")).toBe("neutral")
  })
})

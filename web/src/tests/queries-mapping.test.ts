import { describe, expect, it } from "vitest"
import { mapTableDetail, mapTableSaude } from "@/hooks/queries/catalog"
import { mapSaude } from "@/hooks/queries/dashboard"
import { mapSchema } from "@/hooks/queries/schemas"

describe("mapeamento snake_case → camelCase dos hooks", () => {
  it("schema", () => {
    expect(
      mapSchema({
        schema_name: "CUR_COM",
        table_count: 1,
        view_count: 2,
        camada: "CUR",
        dominio: { code: "COM", name: "Comercial" },
      })
    ).toEqual({
      schemaName: "CUR_COM",
      tableCount: 1,
      viewCount: 2,
      camada: "CUR",
      dominio: { code: "COM", name: "Comercial" },
    })
  })

  it("saúde de tabela", () => {
    expect(
      mapTableSaude({
        total_registros: 252,
        saude: { percentual: 100, classificacao: "Excelente" },
      })
    ).toEqual({
      totalRegistros: 252,
      saude: { percentual: 100, classificacao: "Excelente" },
    })
  })

  it("detalhe de tabela, com e sem completude por coluna", () => {
    const detail = mapTableDetail({
      name: "PAIS",
      type: "Tabela",
      description: null,
      classification: "Restrito",
      conformidade: { aplicavel: true, conformes: 1, avisos: 0, fora: 0, total: 1, percentual: 100 },
      documentacao: { percentual: 0, documentadas: 0, total: 2 },
      schema_name: "CUR_REF",
      total_registros: 252,
      saude: { percentual: 99, classificacao: "Excelente" },
      leitura_negada: false,
      columns: [
        {
          name: "ID_PAIS",
          type: "BIGINT",
          length: 8,
          scale: 0,
          nullable: false,
          order: 0,
          description: null,
          is_primary_key: true,
          domain: "Identificador",
          completude: { percentual: 100, classificacao: "Excelente" },
          conformidade: { resultado: "conforme", problemas: [], sugestao: null },
        },
        {
          name: "DT_ATU_DADOS",
          type: "TIMESTAMP",
          length: null,
          scale: null,
          nullable: true,
          order: 1,
          description: null,
          is_primary_key: false,
          domain: "Data",
          completude: null,
          conformidade: null,
        },
      ],
    })

    expect(detail.leituraNegada).toBe(false)
    expect(detail.schemaName).toBe("CUR_REF")
    expect(detail.totalRegistros).toBe(252)
    expect(detail.columns[0].isPrimaryKey).toBe(true)
    expect(detail.columns[0].completude).toEqual({
      percentual: 100,
      classificacao: "Excelente",
    })
    expect(detail.columns[1].completude).toBeNull()
  })

  it("saúde do dashboard: governada (sem amostra) e legado (com amostra e schemas sem acesso)", () => {
    const base = {
      percentual: 73,
      classificacao: "Bom",
      total_tabelas_avaliadas: 4,
      por_schema: [
        {
          schema_name: "CUR_COM",
          percentual: 100,
          classificacao: "Excelente",
          total_tabelas: 1,
        },
      ],
    }
    const governada = mapSaude(base)
    expect(governada.totalTabelasAvaliadas).toBe(4)
    expect(governada.porSchema[0]).toEqual({
      schemaName: "CUR_COM",
      percentual: 100,
      classificacao: "Excelente",
      totalTabelas: 1,
    })
    expect(governada.amostraPorSchema).toBeUndefined()

    const legado = mapSaude({
      ...base,
      amostra_por_schema: 5,
      schemas_sem_acesso: ["BI"],
    })
    expect(legado.amostraPorSchema).toBe(5)
    expect(legado.schemasSemAcesso).toEqual(["BI"])
  })

  it("detalhe sem permissão de leitura mantém a estrutura e esvazia a saúde", () => {
    const detail = mapTableDetail({
      name: "COMANDO",
      type: "Tabela",
      description: null,
      classification: "Não classificado",
      conformidade: { aplicavel: false, conformes: 0, avisos: 0, fora: 0, total: 0, percentual: null },
      documentacao: { percentual: null, documentadas: 0, total: 0 },
      schema_name: "cur_log",
      total_registros: null,
      saude: null,
      leitura_negada: true,
      columns: [],
    })

    expect(detail.leituraNegada).toBe(true)
    expect(detail.totalRegistros).toBeNull()
    expect(detail.saude).toBeNull()
  })
})

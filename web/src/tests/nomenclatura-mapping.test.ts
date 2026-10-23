import { describe, expect, it } from "vitest"
import { mapTableDetail } from "@/hooks/queries/catalog"
import { mapNomenclatura, mapValidacao } from "@/hooks/queries/nomenclatura"

describe("mapeamento de nomenclatura", () => {
  it("validação: dominios_candidatos vira dominiosCandidatos e sugestão null fica null", () => {
    const validacao = mapValidacao({
      nome: "NM_CLIENTE",
      resultado: "conforme",
      problemas: [],
      sugestao: null,
      ambiguidade: null,
      dominios_candidatos: ["NOME", "DESCRICAO"],
    })

    expect(validacao.dominiosCandidatos).toEqual(["NOME", "DESCRICAO"])
    expect(validacao.sugestao).toBeNull()
    expect(validacao.ambiguidade).toBeNull()
    expect(validacao.resultado).toBe("conforme")
    expect(validacao.nome).toBe("NM_CLIENTE")
  })

  it("validação: mapeia sugestão e ambiguidade quando presentes", () => {
    const validacao = mapValidacao({
      nome: "CLIENTE",
      resultado: "fora",
      problemas: ["sem prefixo"],
      sugestao: { nome: "CD_CLIENTE", dominio: "CODIGO", tipo: "BIGINT", nulo: false },
      ambiguidade: { termos: ["CLIENTE"], opcoes: ["CD_", "NM_"], pergunta: "Código ou nome?" },
      dominios_candidatos: [],
    })

    expect(validacao.problemas).toEqual(["sem prefixo"])
    expect(validacao.sugestao).toEqual({
      nome: "CD_CLIENTE",
      dominio: "CODIGO",
      tipo: "BIGINT",
      nulo: false,
    })
    expect(validacao.ambiguidade).toEqual({
      termos: ["CLIENTE"],
      opcoes: ["CD_", "NM_"],
      pergunta: "Código ou nome?",
    })
  })

  it("regras: data_fonte vira dataFonte e as listas são mapeadas", () => {
    const regras = mapNomenclatura({
      fonte: "SKTIARQ0001",
      versao: "0.2.0",
      data_fonte: "2026-10-01",
      prefixos: [
        { codigo: "CD", significado: "Código", exemplo: "CD_CLIENTE", dominios: ["CODIGO"] },
      ],
      dominios_tipo: [
        {
          codigo: "CODIGO",
          descricao: "Identificador",
          tipo: "BIGINT",
          escala: null,
          nulo: false,
          exemplo: "1",
        },
      ],
      dominios_negocio: [{ codigo: "COM", nome: "Comercial" }],
      camadas: ["STG", "CUR"],
      ambiguidades: [{ termos: ["DT"], opcoes: ["DATA", "DETALHE"], pergunta: "Qual?" }],
    })

    expect(regras.dataFonte).toBe("2026-10-01")
    expect(regras.fonte).toBe("SKTIARQ0001")
    expect(regras.prefixos[0].dominios).toEqual(["CODIGO"])
    expect(regras.dominiosTipo[0].escala).toBeNull()
    expect(regras.dominiosNegocio).toEqual([{ codigo: "COM", nome: "Comercial" }])
    expect(regras.camadas).toEqual(["STG", "CUR"])
    expect(regras.ambiguidades[0].opcoes).toEqual(["DATA", "DETALHE"])
  })
})

describe("detalhe de tabela com conformidade e documentação", () => {
  it("mapeia conformidade da tabela, da coluna e a documentação", () => {
    const detail = mapTableDetail({
      name: "CLIENTE",
      type: "Tabela",
      description: "Clientes",
      classification: "Restrito",
      conformidade: { aplicavel: true, conformes: 1, avisos: 1, fora: 0, total: 2, percentual: 75 },
      documentacao: { percentual: 50, documentadas: 1, total: 2 },
      schema_name: "CUR_COM",
      total_registros: 10,
      saude: null,
      leitura_negada: false,
      columns: [
        {
          name: "CD_CLIENTE",
          type: "BIGINT",
          length: 8,
          scale: 0,
          nullable: false,
          order: 0,
          description: "Código",
          is_primary_key: true,
          domain: "Identificador",
          completude: null,
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

    expect(detail.conformidade).toEqual({
      aplicavel: true,
      conformes: 1,
      avisos: 1,
      fora: 0,
      total: 2,
      percentual: 75,
    })
    expect(detail.documentacao).toEqual({ percentual: 50, documentadas: 1, total: 2 })
    expect(detail.columns[0].conformidade).toEqual({
      resultado: "conforme",
      problemas: [],
      sugestao: null,
    })
    expect(detail.columns[1].conformidade).toBeNull()
  })
})

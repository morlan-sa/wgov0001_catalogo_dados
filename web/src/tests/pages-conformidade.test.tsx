// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Route, Routes } from "react-router-dom"
import { api } from "@/lib/api"
import { CatalogoSchema } from "@/pages/catalogo-schema"
import { CatalogoTabela } from "@/pages/catalogo-tabela"
import { renderWithProviders } from "./test-utils"

vi.mock("@/lib/api", () => ({ api: { get: vi.fn() } }))
const getMock = vi.mocked(api.get)

const CONF_ZERO = {
  aplicavel: false,
  conformes: 0,
  avisos: 0,
  fora: 0,
  total: 0,
  percentual: null,
}

function coluna(name: string, conformidade: unknown) {
  return {
    name,
    type: "VARCHAR",
    length: 10,
    scale: 0,
    nullable: false,
    order: 1,
    description: null,
    is_primary_key: false,
    domain: "Código",
    completude: null,
    conformidade,
  }
}

const DETALHE_RAW = {
  schema_name: "CUR_COM",
  name: "FORNECEDOR",
  type: "Tabela",
  description: "Cadastro de fornecedores",
  classification: "Restrito",
  conformidade: {
    aplicavel: true,
    conformes: 1,
    avisos: 0,
    fora: 1,
    total: 2,
    percentual: 50,
  },
  documentacao: { percentual: 50, documentadas: 1, total: 2 },
  total_registros: 1200,
  saude: { percentual: 95, classificacao: "Excelente" },
  leitura_negada: false,
  columns: [
    coluna("COD_FORNEC", {
      resultado: "fora",
      problemas: ["Prefixo COD não segue o padrão"],
      sugestao: { nome: "CD_FORNEC", dominio: "Código", tipo: null, nulo: null },
    }),
    coluna("CD_PRODUTO", { resultado: "conforme", problemas: [], sugestao: null }),
    coluna("DT_GRAV_DADOS", null),
  ],
}

const DETALHE_LEGADO_RAW = {
  ...DETALHE_RAW,
  schema_name: "COMPRAS",
  conformidade: CONF_ZERO,
  documentacao: { percentual: null, documentadas: 0, total: 0 },
  columns: [coluna("COD_FORNEC", null)],
}

function renderTabela(raw: unknown) {
  getMock.mockResolvedValue({ data: raw })
  renderWithProviders(
    <Routes>
      <Route path="/catalogo/:schema/:table" element={<CatalogoTabela />} />
    </Routes>,
    { routerProps: { initialEntries: ["/catalogo/CUR_COM/FORNECEDOR"] } }
  )
}

beforeEach(() => {
  getMock.mockReset()
})

describe("Detalhe da tabela — conformidade", () => {
  it("mostra os três cartões do topo", async () => {
    renderTabela(DETALHE_RAW)

    expect(await screen.findByText("Conformidade de nomes")).toBeInTheDocument()
    // um "50%" no cartão de conformidade e outro no de documentação
    expect(screen.getAllByText("50%")).toHaveLength(2)
    expect(screen.getByText("1 de 2 colunas")).toBeInTheDocument()
    expect(screen.getByText("1 de 2 com descrição")).toBeInTheDocument()
    expect(screen.getByText("Saúde dos dados")).toBeInTheDocument()
    expect(screen.getByText("95%")).toBeInTheDocument()
  })

  it("mostra o selo 'Fora do padrão' e a sugestão CD_FORNEC na coluna COD_FORNEC", async () => {
    renderTabela(DETALHE_RAW)

    const linha = (await screen.findByText("COD_FORNEC")).closest("tr")!
    expect(within(linha).getByText("✖ Fora do padrão")).toBeInTheDocument()
    expect(within(linha).getByText("→ CD_FORNEC")).toBeInTheDocument()
    expect(
      within(linha).getByText("Prefixo COD não segue o padrão")
    ).toBeInTheDocument()
  })

  it("coluna sem avaliação (auditoria) mostra '—' em Conformidade", async () => {
    renderTabela(DETALHE_RAW)

    const linha = (await screen.findByText("DT_GRAV_DADOS")).closest("tr")!
    expect(within(linha).getByText("—")).toBeInTheDocument()
  })

  it("o filtro 'só não conformes' esconde as colunas conformes e as sem avaliação", async () => {
    renderTabela(DETALHE_RAW)
    await screen.findByText("CD_PRODUTO")

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Só não conformes" })
    )

    expect(screen.queryByText("CD_PRODUTO")).not.toBeInTheDocument()
    expect(screen.queryByText("DT_GRAV_DADOS")).not.toBeInTheDocument()
    expect(screen.getByText("COD_FORNEC")).toBeInTheDocument()
  })

  it("tabela legada mostra 'Não aplicável' e documentação sem percentual", async () => {
    renderTabela(DETALHE_LEGADO_RAW)

    expect(
      await screen.findByText("Não aplicável (schema legado)")
    ).toBeInTheDocument()
    expect(screen.getByText("0 de 0 com descrição")).toBeInTheDocument()
  })

  it("mantém a mensagem de leitura negada na saúde", async () => {
    renderTabela({
      ...DETALHE_RAW,
      leitura_negada: true,
      total_registros: null,
      saude: null,
    })

    expect(
      await screen.findByText(/Sem permissão de leitura dos dados desta tabela/)
    ).toBeInTheDocument()
  })
})

describe("Lista de tabelas do schema — conformidade", () => {
  function tabela(name: string, conformidade: unknown) {
    return {
      name,
      type: "Tabela",
      description: null,
      classification: "Restrito",
      conformidade,
    }
  }

  function renderSchema(tabelas: unknown[]) {
    getMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/saude")) throw new Error("sem saúde no teste")
      return { data: tabelas }
    })
    renderWithProviders(
      <Routes>
        <Route path="/catalogo/:schema" element={<CatalogoSchema />} />
      </Routes>,
      { routerProps: { initialEntries: ["/catalogo/CUR_COM"] } }
    )
  }

  it("mostra o percentual de cada tabela e o resumo do schema", async () => {
    renderSchema([
      tabela("FORNECEDOR", {
        aplicavel: true,
        conformes: 3,
        avisos: 1,
        fora: 0,
        total: 4,
        percentual: 88,
      }),
      tabela("PRODUTO", {
        aplicavel: true,
        conformes: 1,
        avisos: 0,
        fora: 3,
        total: 4,
        percentual: 25,
      }),
      tabela("SEM_COLUNAS", {
        aplicavel: true,
        conformes: 0,
        avisos: 0,
        fora: 0,
        total: 0,
        percentual: null,
      }),
    ])

    const linhaForn = (await screen.findByText("FORNECEDOR")).closest("tr")!
    expect(within(linhaForn).getByText("88%")).toBeInTheDocument()
    const linhaProd = screen.getByText("PRODUTO").closest("tr")!
    expect(within(linhaProd).getByText("25%")).toBeInTheDocument()
    const linhaSem = screen.getByText("SEM_COLUNAS").closest("tr")!
    expect(within(linhaSem).getByText("—")).toBeInTheDocument()
    // (4 + 0,5) / 8 = 56 %
    expect(
      screen.getByText(
        "Conformidade de nomes do schema: 56% (4 de 8 colunas conformes)"
      )
    ).toBeInTheDocument()
  })

  it("schema legado mostra 'N/A' e não mostra o resumo", async () => {
    renderSchema([tabela("COMPRAS_T", CONF_ZERO)])

    const linha = (await screen.findByText("COMPRAS_T")).closest("tr")!
    expect(within(linha).getByText("N/A")).toBeInTheDocument()
    expect(
      screen.queryByText(/Conformidade de nomes do schema/)
    ).not.toBeInTheDocument()
  })
})

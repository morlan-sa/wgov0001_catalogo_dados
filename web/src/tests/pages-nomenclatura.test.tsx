// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { api } from "@/lib/api"
import { Nomenclatura } from "@/pages/nomenclatura"
import { renderWithProviders } from "./test-utils"

vi.mock("@/lib/api", () => ({ api: { get: vi.fn(), post: vi.fn() } }))
const getMock = vi.mocked(api.get)
const postMock = vi.mocked(api.post)

const REGRAS_RAW = {
  fonte: "SKTIARQ0001",
  versao: "0.2.0",
  data_fonte: "2026-08-04",
  prefixos: [
    {
      codigo: "CD",
      significado: "Código",
      exemplo: "Código único de uma entidade",
      dominios: ["CD_INT", "CD_VAR"],
    },
    {
      codigo: "DT",
      significado: "Data",
      exemplo: "Representa datas",
      dominios: ["DT"],
    },
  ],
  dominios_tipo: [
    {
      codigo: "CD_INT",
      descricao: "Código inteiro",
      tipo: "INTEGER",
      escala: null,
      nulo: false,
      exemplo: "CD_PEDIDO",
    },
    {
      codigo: "CD_VAR",
      descricao: "Código alfanumérico",
      tipo: "VARCHAR",
      escala: "20",
      nulo: false,
      exemplo: "CD_FORNEC_EXT",
    },
  ],
  dominios_negocio: [{ codigo: "COM", nome: "Comercial" }],
  camadas: ["STG", "CUR", "RPT"],
  ambiguidades: [
    {
      termos: ["DATA", "HORA"],
      opcoes: ["DT", "DT_TST"],
      pergunta: "É só data ou data e hora?",
    },
  ],
}

const FORA_RAW = {
  nome: "COD_FORNEC",
  resultado: "fora",
  problemas: ["O prefixo COD não existe no padrão."],
  sugestao: { nome: "CD_FORNEC", dominio: "CD_VAR", tipo: "VARCHAR(20)", nulo: false },
  ambiguidade: null,
  dominios_candidatos: [],
}

beforeEach(() => {
  getMock.mockReset()
  postMock.mockReset()
  getMock.mockResolvedValue({ data: REGRAS_RAW })
})

describe("Padrões de Nomenclatura", () => {
  it("lista os prefixos e mostra a versão da fonte", async () => {
    renderWithProviders(<Nomenclatura />)

    expect(await screen.findByText("Código único de uma entidade")).toBeInTheDocument()
    expect(screen.getByText("Representa datas")).toBeInTheDocument()
    expect(screen.getByText("Fonte: SKTIARQ0001 v0.2.0 (04/08/2026)")).toBeInTheDocument()
    expect(getMock).toHaveBeenCalledWith("/nomenclatura")
  })

  it("validar COD_FORNEC mostra fora do padrão e a sugestão CD_FORNEC", async () => {
    postMock.mockResolvedValue({ data: FORA_RAW })
    renderWithProviders(<Nomenclatura />)
    await screen.findByText("Representa datas")

    await userEvent.type(screen.getByLabelText("Nome da coluna"), "COD_FORNEC")
    await userEvent.click(screen.getByRole("button", { name: "Validar" }))

    expect(await screen.findByText(/Fora do padrão/)).toBeInTheDocument()
    expect(screen.getByText("O prefixo COD não existe no padrão.")).toBeInTheDocument()
    expect(screen.getByText("CD_FORNEC")).toBeInTheDocument()
    expect(postMock).toHaveBeenCalledWith("/nomenclatura/validar", { nome: "COD_FORNEC" })
    expect(screen.getByRole("button", { name: "Copiar nome" })).toBeInTheDocument()
  })

  it("nome ambíguo mostra a pergunta com as opções", async () => {
    postMock.mockResolvedValue({
      data: {
        nome: "DATA_HORA",
        resultado: "aviso",
        problemas: ["O nome é ambíguo."],
        sugestao: null,
        ambiguidade: REGRAS_RAW.ambiguidades[0],
        dominios_candidatos: [],
      },
    })
    renderWithProviders(<Nomenclatura />)
    await screen.findByText("Representa datas")

    await userEvent.type(screen.getByLabelText("Nome da coluna"), "DATA_HORA")
    await userEvent.click(screen.getByRole("button", { name: "Validar" }))

    const pergunta = await screen.findByTestId("ambiguidade-resultado")
    expect(within(pergunta).getByText("É só data ou data e hora?")).toBeInTheDocument()
    expect(within(pergunta).getByText("DT")).toBeInTheDocument()
    expect(within(pergunta).getByText("DT_TST")).toBeInTheDocument()
  })

  it("nome ambíguo mostra a pergunta e não oferece nome para copiar", async () => {
    postMock.mockResolvedValue({
      data: {
        nome: "NUMERO_NOTA",
        resultado: "fora",
        problemas: ["O prefixo NUMERO não faz parte da convenção."],
        sugestao: { nome: null, dominio: null, tipo: null, nulo: null },
        ambiguidade: REGRAS_RAW.ambiguidades[0],
        dominios_candidatos: [],
      },
    })
    renderWithProviders(<Nomenclatura />)
    await screen.findByText("Representa datas")

    await userEvent.type(screen.getByLabelText("Nome da coluna"), "NUMERO_NOTA")
    await userEvent.click(screen.getByRole("button", { name: "Validar" }))

    const pergunta = await screen.findByTestId("ambiguidade-resultado")
    expect(within(pergunta).getByText("É só data ou data e hora?")).toBeInTheDocument()
    expect(screen.queryByText("Sugestão:")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Copiar nome" })).not.toBeInTheDocument()
  })

  it("domínios candidatos reexecutam a validação com o tipo do domínio escolhido", async () => {
    postMock.mockResolvedValueOnce({
      data: {
        nome: "CD_X",
        resultado: "aviso",
        problemas: [],
        sugestao: null,
        ambiguidade: null,
        dominios_candidatos: ["CD_INT", "CD_VAR"],
      },
    })
    postMock.mockResolvedValueOnce({
      data: { ...FORA_RAW, nome: "CD_X", resultado: "conforme", problemas: [], sugestao: null },
    })
    renderWithProviders(<Nomenclatura />)
    await screen.findByText("Representa datas")

    await userEvent.type(screen.getByLabelText("Nome da coluna"), "CD_X")
    await userEvent.click(screen.getByRole("button", { name: "Validar" }))
    expect(
      await screen.findByText(
        "O prefixo tem mais de um domínio de tipo — qual se aplica?"
      )
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "CD_VAR" }))

    await waitFor(() =>
      expect(postMock).toHaveBeenLastCalledWith("/nomenclatura/validar", {
        nome: "CD_X",
        tipo: "VARCHAR",
        tamanho: 20,
      })
    )
    expect(await screen.findByText(/Conforme/)).toBeInTheDocument()
  })

  it("o filtro de prefixos reduz a lista", async () => {
    renderWithProviders(<Nomenclatura />)
    await screen.findByText("Representa datas")

    await userEvent.type(screen.getByLabelText("Filtrar prefixos"), "data")

    await waitFor(() =>
      expect(screen.queryByText("Código único de uma entidade")).not.toBeInTheDocument()
    )
    expect(screen.getByText("Representa datas")).toBeInTheDocument()
  })
})

// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useLocation } from "react-router-dom"
import { api } from "@/lib/api"
import { Catalogo } from "@/pages/catalogo"
import { Scanner } from "@/pages/scanner"
import { renderWithProviders } from "./test-utils"

vi.mock("@/lib/api", () => ({ api: { get: vi.fn() } }))
const getMock = vi.mocked(api.get)

const SCHEMAS_RAW = [
  {
    schema_name: "CUR_COM",
    table_count: 1,
    view_count: 0,
    camada: "CUR",
    dominio: { code: "COM", name: "Comercial" },
  },
  {
    schema_name: "COMPRAS",
    table_count: 428,
    view_count: 10,
    camada: "LEGADO",
    dominio: { code: "NC", name: "Não classificado" },
  },
]

function LocationProbe() {
  const { pathname, search } = useLocation()
  return <p data-testid="location">{pathname + search}</p>
}

beforeEach(() => {
  getMock.mockReset()
  getMock.mockResolvedValue({ data: SCHEMAS_RAW })
})

describe("Catálogo", () => {
  it("lista os schemas e repassa o filtro da URL ao BFF", async () => {
    renderWithProviders(<Catalogo />, {
      routerProps: { initialEntries: ["/catalogo?filter=CUR_COM,COMPRAS"] },
    })

    expect(await screen.findByText("CUR_COM")).toBeInTheDocument()
    expect(screen.getByText("COMPRAS")).toBeInTheDocument()
    expect(getMock).toHaveBeenCalledWith("/catalog/schemas", {
      params: { filter: "CUR_COM,COMPRAS" },
    })
  })

  it("a busca de schema filtra a lista", async () => {
    renderWithProviders(<Catalogo />, {
      routerProps: { initialEntries: ["/catalogo"] },
    })
    await screen.findByText("CUR_COM")

    await userEvent.type(screen.getByLabelText("Buscar schema"), "compras")

    await waitFor(() => expect(screen.queryByText("CUR_COM")).not.toBeInTheDocument())
    expect(screen.getByText("COMPRAS")).toBeInTheDocument()
  })

  it("mostra a mensagem do BFF quando a consulta falha", async () => {
    getMock.mockRejectedValue({
      response: { status: 503, data: { detail: "DB2 fora do ar" } },
    })
    renderWithProviders(<Catalogo />, {
      routerProps: { initialEntries: ["/catalogo"] },
    })

    expect(await screen.findByRole("alert")).toHaveTextContent("DB2 fora do ar")
  })
})

describe("Scanner", () => {
  it("atalho 'governados' pré-seleciona só os não legados e consulta o catálogo filtrado", async () => {
    renderWithProviders(
      <>
        <Scanner />
        <LocationProbe />
      </>,
      { routerProps: { initialEntries: ["/scanner"] } }
    )

    await userEvent.click(await screen.findByText("Schemas governados"))

    const consultar = await screen.findByRole("button", { name: /Consultar/ })
    expect(consultar).toHaveTextContent("(1 schemas)")
    await userEvent.click(consultar)

    expect(screen.getByTestId("location")).toHaveTextContent("/catalogo?filter=CUR_COM")
  })

  it("escolha manual começa sem seleção, com 'Consultar' desabilitado", async () => {
    renderWithProviders(<Scanner />, {
      routerProps: { initialEntries: ["/scanner"] },
    })

    await userEvent.click(await screen.findByText("Escolher manualmente"))

    expect(await screen.findByRole("button", { name: /Consultar/ })).toBeDisabled()
  })
})

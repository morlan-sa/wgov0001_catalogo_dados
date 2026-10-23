// @vitest-environment jsdom

import { describe, it, expect } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import { AxiosError } from "axios"
import { RouteErrorBoundary } from "@/components/route-error-boundary"
import { NotFoundError } from "@/utils/errors"

function ThrowsOnRender(): never {
  throw new Error("boom from a component")
}

function ThrowsNotFoundOnRender(): never {
  throw new AxiosError("Not Found", undefined, undefined, undefined, {
    status: 404,
    statusText: "Not Found",
    headers: {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: {} as any,
    data: null,
  })
}

function ThrowsInvalidIdOnRender(): never {
  throw new NotFoundError("Id inválido: abc")
}

describe("RouteErrorBoundary", () => {
  it("renders the fallback UI instead of crashing when a route errors", async () => {
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: <ThrowsOnRender />,
          errorElement: <RouteErrorBoundary />,
        },
      ],
      { initialEntries: ["/"] }
    )
    render(<RouterProvider router={router} />)

    await waitFor(() =>
      expect(screen.getByText("Algo deu errado")).toBeInTheDocument()
    )
    expect(screen.getByText("boom from a component")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Voltar ao início" })
    ).toBeInTheDocument()
  })

  it("renders NotFound (not the generic error card) when a 404 is thrown", async () => {
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: <ThrowsNotFoundOnRender />,
          errorElement: <RouteErrorBoundary />,
        },
      ],
      { initialEntries: ["/"] }
    )
    render(<RouterProvider router={router} />)

    await waitFor(() =>
      expect(screen.getByText("Página não encontrada")).toBeInTheDocument()
    )
    expect(screen.queryByText("Algo deu errado")).not.toBeInTheDocument()
  })

  it("renders NotFound for a client-side NotFoundError", async () => {
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: <ThrowsInvalidIdOnRender />,
          errorElement: <RouteErrorBoundary />,
        },
      ],
      { initialEntries: ["/"] }
    )
    render(<RouterProvider router={router} />)

    await waitFor(() =>
      expect(screen.getByText("Página não encontrada")).toBeInTheDocument()
    )
    expect(screen.queryByText("Algo deu errado")).not.toBeInTheDocument()
  })
})

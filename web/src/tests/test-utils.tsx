import { render, type RenderResult } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, type MemoryRouterProps } from "react-router-dom"
import type { ReactNode } from "react"

export function makeQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

interface RenderWithProvidersOptions {
  routerProps?: MemoryRouterProps
  queryClient?: QueryClient
}

export function renderWithProviders(
  ui: ReactNode,
  { routerProps, queryClient }: RenderWithProvidersOptions = {}
): RenderResult {
  const client = queryClient ?? makeQueryClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter {...routerProps}>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

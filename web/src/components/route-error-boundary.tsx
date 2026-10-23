import { AxiosError } from "axios"
import { Button, Card, H2, P } from "@morlan/ui"
import { isRouteErrorResponse, useRouteError } from "react-router-dom"
import { NotFound } from "@/pages/not-found"
import { NotFoundError } from "@/utils/errors"

/**
 * Fallback de erro para toda a árvore de rotas (`errorElement` no route
 * raiz em `App.tsx`) — sem isto, um erro de render não tratado cai no
 * error screen padrão do react-router, sem estilo nenhum.
 *
 * 404 (recurso inexistente vindo do backend, ou `:id` de rota inválido
 * detectado no client via `NotFoundError`) é lançado pelo componente que
 * busca/valida os dados para ser tratado aqui — fora dele — em vez de cada
 * consumidor decidir renderizar `NotFound` por conta própria.
 */
export function RouteErrorBoundary() {
  const error = useRouteError()

  const isNotFound =
    (error instanceof AxiosError && error.status === 404) ||
    error instanceof NotFoundError ||
    (isRouteErrorResponse(error) && error.status === 404)
  if (isNotFound) return <NotFound />

  const message = isRouteErrorResponse(error)
    ? error.statusText || `Erro ${error.status}`
    : error instanceof Error
      ? error.message
      : "Erro desconhecido"

  return (
    <div className="flex h-screen items-center justify-center p-4">
      <Card className="max-w-md p-6 text-center">
        <H2>Algo deu errado</H2>
        <P className="mt-2 text-sm text-muted-foreground">{message}</P>
        <Button className="mt-4" onClick={() => window.location.assign("/")}>
          Voltar ao início
        </Button>
      </Card>
    </div>
  )
}

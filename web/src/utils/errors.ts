/** Sinaliza um recurso inexistente/inválido a partir de validação local (ex.:
 * um `:id` de rota que não é sequer um número), sem depender de uma resposta
 * HTTP real. `RouteErrorBoundary` trata isto como um 404 igual a um
 * `AxiosError` de status 404, renderizando `NotFound`. */
export class NotFoundError extends Error {
  readonly status = 404

  constructor(message = "Recurso não encontrado") {
    super(message)
    this.name = "NotFoundError"
  }
}

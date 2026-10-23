export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)

  if (parts.length === 0) return ""
  if (parts.length === 1) {
    return parts[0][0].toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Extrai uma mensagem acionável de um erro do axios/fetch. Prefere o `detail`
 * do body (traduzido em português pelo backend); cai para uma mensagem
 * genérica em `fallback` se não conseguir.
 */
export function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as {
    response?: { data?: { detail?: unknown }; status?: number }
    message?: string
  }
  const detail = anyErr?.response?.data?.detail
  if (typeof detail === "string" && detail.trim()) return detail
  const status = anyErr?.response?.status
  if (typeof status === "number" && status >= 500) {
    return "Erro do servidor. Tente novamente em alguns instantes."
  }
  return fallback
}

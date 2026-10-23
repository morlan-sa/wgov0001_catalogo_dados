import { QueryClient } from "@tanstack/react-query"

const DEFAULT_RETRY = 1
const DEFAULT_STALE_TIME_MS = 300_000

function envInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return value && Number.isFinite(parsed) ? parsed : fallback
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: envInt(import.meta.env.VITE_QUERY_RETRY, DEFAULT_RETRY),
      staleTime: envInt(
        import.meta.env.VITE_QUERY_STALE_TIME_MS,
        DEFAULT_STALE_TIME_MS
      ),
    },
  },
})

import { P, Skeleton } from "@morlan/ui"
import { extractErrorMessage } from "@/utils/format"

/** Mensagem de erro de uma query, com o `detail` do BFF quando houver. */
export function QueryError({
  error,
  fallback,
}: {
  error: unknown
  fallback: string
}) {
  return (
    <P role="alert" className="text-sm text-destructive">
      {extractErrorMessage(error, fallback)}
    </P>
  )
}

/** Placeholder de carregamento de uma listagem. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}

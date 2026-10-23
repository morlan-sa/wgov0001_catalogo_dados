import { Badge, type BadgeVariant } from "@morlan/ui"
import type { ResultadoAvaliacao } from "@/hooks/queries/nomenclatura"

// Símbolo + texto: o resultado nunca depende só da cor.
const SELO: Record<ResultadoAvaliacao, { variant: BadgeVariant; texto: string }> = {
  conforme: { variant: "success", texto: "✔ Conforme" },
  aviso: { variant: "warning", texto: "⚠ Aviso" },
  fora: { variant: "destructive", texto: "✖ Fora do padrão" },
}

export function SeloConformidade({ resultado }: { resultado: ResultadoAvaliacao }) {
  const { variant, texto } = SELO[resultado]
  return <Badge variant={variant}>{texto}</Badge>
}

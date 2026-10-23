import type { BadgeVariant } from "@morlan/ui"

// Classificação da informação (Sigiloso…Público) e classe de completude
// (Atenção/Bom/Excelente) compartilham o mesmo selo — o texto vem do BFF.
const VARIANT_BY_LABEL: Record<string, BadgeVariant> = {
  Sigiloso: "destructive",
  Restrito: "warning",
  Corporativo: "info",
  Público: "success",
  "Não classificado": "neutral",
  Atenção: "destructive",
  Bom: "info",
  Excelente: "success",
}

export function statusVariant(label: string): BadgeVariant {
  return VARIANT_BY_LABEL[label] ?? "neutral"
}

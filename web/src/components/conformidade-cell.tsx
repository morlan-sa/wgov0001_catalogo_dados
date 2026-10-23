import { Span } from "@morlan/ui"
import { SeloConformidade } from "@/components/selo-conformidade"
import type { Avaliacao } from "@/hooks/queries/nomenclatura"

/** Selo da coluna + sugestão de nome e problemas logo abaixo; "—" sem avaliação. */
export function ConformidadeCell({ avaliacao }: { avaliacao: Avaliacao | null }) {
  if (!avaliacao) return <Span variant="small">—</Span>

  const sugestao = avaliacao.sugestao?.nome
  return (
    <div className="flex flex-col items-start gap-1">
      <SeloConformidade resultado={avaliacao.resultado} />
      {sugestao && <Span variant="small">→ {sugestao}</Span>}
      {avaliacao.problemas.map((p) => (
        <Span key={p} variant="muted">
          {p}
        </Span>
      ))}
    </div>
  )
}

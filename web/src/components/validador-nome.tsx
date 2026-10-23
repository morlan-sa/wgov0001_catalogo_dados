import { useState, type FormEvent } from "react"
import { Badge, Button, Card, H2, Input, P, Span, toast } from "@morlan/ui"
import {
  useValidarNome,
  type DominioTipo,
  type ResultadoAvaliacao,
  type Validacao,
  type ValidarNomeInput,
} from "@/hooks/queries/nomenclatura"
import { QueryError } from "@/components/query-feedback"

const RESULTADO: Record<
  ResultadoAvaliacao,
  { rotulo: string; simbolo: string; variant: "success" | "warning" | "destructive" }
> = {
  conforme: { rotulo: "Conforme", simbolo: "✔", variant: "success" },
  aviso: { rotulo: "Aviso", simbolo: "⚠", variant: "warning" },
  fora: { rotulo: "Fora do padrão", simbolo: "✖", variant: "destructive" },
}

async function copiarNome(nome: string) {
  try {
    await navigator.clipboard.writeText(nome)
    toast.success("Nome copiado.")
  } catch {
    toast.error("Não foi possível copiar o nome.")
  }
}

function Resultado({
  validacao,
  dominiosTipo,
  onEscolherDominio,
}: {
  validacao: Validacao
  dominiosTipo: DominioTipo[]
  onEscolherDominio: (dominio: DominioTipo) => void
}) {
  const { rotulo, simbolo, variant } = RESULTADO[validacao.resultado]
  const sugestao = validacao.sugestao
  const candidatos = validacao.dominiosCandidatos
    .map((codigo) => dominiosTipo.find((d) => d.codigo === codigo))
    .filter((d): d is DominioTipo => d !== undefined)

  return (
    <div className="mt-4 space-y-3" aria-live="polite">
      <div className="flex items-center gap-2">
        <Badge variant={variant}>
          <span aria-hidden="true">{simbolo}</span> {rotulo}
        </Badge>
        <Span variant="muted" className="font-mono">
          {validacao.nome}
        </Span>
      </div>

      {validacao.problemas.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {validacao.problemas.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      {sugestao?.nome && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Span variant="muted">Sugestão:</Span>
          <Span className="font-mono font-semibold">{sugestao.nome}</Span>
          {sugestao.dominio && <Badge variant="neutral">{sugestao.dominio}</Badge>}
          {sugestao.tipo && <Span variant="small">{sugestao.tipo}</Span>}
          {sugestao.nulo !== null && (
            <Span variant="small">{sugestao.nulo ? "aceita nulo" : "não aceita nulo"}</Span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void copiarNome(sugestao.nome as string)}
          >
            Copiar nome
          </Button>
        </div>
      )}

      {validacao.ambiguidade && (
        <div data-testid="ambiguidade-resultado" className="space-y-2">
          <P className="text-sm font-medium">{validacao.ambiguidade.pergunta}</P>
          <div className="flex flex-wrap gap-2">
            {validacao.ambiguidade.opcoes.map((o) => (
              <Badge key={o} variant="info">
                {o}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {candidatos.length > 0 && (
        <div className="space-y-2">
          <P className="text-sm font-medium">
            O prefixo tem mais de um domínio de tipo — qual se aplica?
          </P>
          <div className="flex flex-wrap gap-2">
            {candidatos.map((d) => (
              <Button
                key={d.codigo}
                type="button"
                variant="outline"
                size="sm"
                title={d.descricao}
                onClick={() => onEscolherDominio(d)}
              >
                {d.codigo}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function ValidadorNome({ dominiosTipo }: { dominiosTipo: DominioTipo[] }) {
  const [nome, setNome] = useState("")
  const [tipo, setTipo] = useState("")
  const [tamanho, setTamanho] = useState("")
  const validar = useValidarNome()

  function enviar(e: FormEvent) {
    e.preventDefault()
    const input: ValidarNomeInput = { nome: nome.trim() }
    if (tipo.trim()) input.tipo = tipo.trim()
    if (tamanho.trim()) input.tamanho = Number(tamanho)
    validar.mutate(input)
  }

  function escolherDominio(dominio: DominioTipo, nomeValidado: string) {
    const input: ValidarNomeInput = { nome: nomeValidado, tipo: dominio.tipo }
    if (dominio.escala !== null && /^\d+$/.test(dominio.escala)) {
      input.tamanho = Number(dominio.escala)
    }
    validar.mutate(input)
  }

  return (
    <Card className="mb-6 p-4">
      <H2 className="mb-1 text-lg font-semibold">Validador de nome</H2>
      <P className="mb-3 text-sm text-muted-foreground">
        Confira se o nome de uma coluna segue o padrão corporativo e veja a
        sugestão de nome e tipo.
      </P>
      <form onSubmit={enviar} className="flex flex-wrap items-end gap-2">
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome da coluna (ex.: COD_FORNEC)"
          aria-label="Nome da coluna"
          className="max-w-xs font-mono"
        />
        <Input
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          placeholder="Tipo (opcional)"
          aria-label="Tipo da coluna"
          className="max-w-40"
        />
        <Input
          type="number"
          min={1}
          value={tamanho}
          onChange={(e) => setTamanho(e.target.value)}
          placeholder="Tamanho"
          aria-label="Tamanho da coluna"
          className="max-w-28"
        />
        <Button type="submit" disabled={!nome.trim()} isLoading={validar.isPending}>
          Validar
        </Button>
      </form>

      {validar.isError && (
        <div className="mt-4">
          <QueryError error={validar.error} fallback="Erro ao validar o nome." />
        </div>
      )}
      {validar.data && (
        <Resultado
          validacao={validar.data}
          dominiosTipo={dominiosTipo}
          onEscolherDominio={(d) => escolherDominio(d, validar.data.nome)}
        />
      )}
    </Card>
  )
}

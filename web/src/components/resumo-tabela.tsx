import { StatCard } from "@/components/stat-card"
import type { TableDetail } from "@/hooks/queries/catalog"

const SEM_VALOR = "—"

function pct(valor: number | null): string {
  return valor === null ? SEM_VALOR : `${valor}%`
}

/** Três cartões no topo do detalhe: saúde dos dados, conformidade de nomes e documentação. */
export function ResumoTabela({ detail: d }: { detail: TableDetail }) {
  const saudeOk = d.saude !== null && d.totalRegistros !== null
  const { conformidade, documentacao } = d

  return (
    <div className="mb-4 flex flex-wrap gap-3">
      <StatCard
        label="Saúde dos dados"
        value={saudeOk ? `${d.saude?.percentual}%` : SEM_VALOR}
        subtitle={
          saudeOk
            ? `${d.totalRegistros?.toLocaleString("pt-BR")} registro(s) · ${d.saude?.classificacao}`
            : "Sem permissão de leitura dos dados desta tabela — a saúde não pôde ser calculada."
        }
      />
      <StatCard
        label="Conformidade de nomes"
        value={conformidade.aplicavel ? pct(conformidade.percentual) : SEM_VALOR}
        subtitle={
          conformidade.aplicavel
            ? `${conformidade.conformes} de ${conformidade.total} colunas`
            : "Não aplicável (schema legado)"
        }
      />
      <StatCard
        label="Documentação"
        value={pct(documentacao.percentual)}
        subtitle={`${documentacao.documentadas} de ${documentacao.total} com descrição`}
      />
    </div>
  )
}

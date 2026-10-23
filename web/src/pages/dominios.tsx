import { Link } from "react-router-dom"
import { Badge, Card, P, Span } from "@morlan/ui"
import { BreadcrumbTrail } from "@/components/breadcrumb-trail"
import { ListSkeleton, QueryError } from "@/components/query-feedback"
import { useDomains, type Domain } from "@/hooks/queries/domains"

function DomainCard({ domain }: { domain: Domain }) {
  const emUso = domain.schemaCount > 0
  const card = (
    <Card
      className={`h-full gap-1 p-3 ${
        emUso ? "transition-colors hover:border-primary" : "opacity-60"
      }`}
    >
      <div className="flex items-center gap-2">
        <Badge variant={emUso ? "info" : "neutral"} className="font-mono">
          {domain.code}
        </Badge>
        <P className={`font-semibold ${emUso ? "text-primary" : ""}`}>
          {domain.name}
        </P>
      </div>
      <Span variant="muted">
        {domain.schemaCount} schema(s) · {domain.objectCount} tabela(s)/view(s)
      </Span>
    </Card>
  )

  return emUso ? <Link to={`/dominios/${domain.code}`}>{card}</Link> : card
}

export function Dominios() {
  const domains = useDomains()

  return (
    <div>
      <BreadcrumbTrail items={[{ label: "Domínios" }]} />
      <P className="mb-4 text-sm text-muted-foreground">
        Catálogo corporativo de domínios de negócio, com quantos schemas e
        objetos do banco já usam cada um
      </P>

      {domains.isError ? (
        <QueryError error={domains.error} fallback="Erro ao carregar os domínios." />
      ) : domains.isPending ? (
        <ListSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {domains.data.map((d) => (
            <DomainCard key={d.code} domain={d} />
          ))}
        </div>
      )}
    </div>
  )
}

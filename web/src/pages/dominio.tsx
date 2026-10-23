import { Link, useNavigate, useParams } from "react-router-dom"
import { Badge, Card, H2, P, Select, Span } from "@morlan/ui"
import { BreadcrumbTrail } from "@/components/breadcrumb-trail"
import { ListSkeleton, QueryError } from "@/components/query-feedback"
import { useCatalogTables } from "@/hooks/queries/catalog"
import { useCatalogSchemas, type Schema } from "@/hooks/queries/schemas"

function SchemaCard({ schema }: { schema: Schema }) {
  const navigate = useNavigate()
  const tables = useCatalogTables(schema.schemaName)
  const options = (tables.data ?? []).map((t) => ({
    value: t.name,
    label: `${t.name} (${t.type})`,
  }))

  const placeholder = tables.isPending
    ? "Carregando tabelas..."
    : options.length === 0
      ? "Sem tabelas catalogadas"
      : "Selecione uma tabela..."

  return (
    <Card className="gap-2 p-3">
      <div className="flex items-center justify-between">
        <Link
          to={`/catalogo/${schema.schemaName}`}
          className="font-semibold text-primary hover:underline"
        >
          {schema.schemaName}
        </Link>
        <Span variant="small">
          {schema.tableCount} tabelas · {schema.viewCount} views
        </Span>
      </div>
      <Select
        value={null}
        options={options}
        placeholder={placeholder}
        disabled={options.length === 0}
        onChange={(table) => {
          if (table) navigate(`/catalogo/${schema.schemaName}/${table}`)
        }}
      />
    </Card>
  )
}

export function Dominio() {
  const { code = "" } = useParams()
  const schemas = useCatalogSchemas(null)
  const doDominio = (schemas.data ?? []).filter((s) => s.dominio.code === code)
  const domainName = doDominio[0]?.dominio.name ?? code

  return (
    <div>
      <BreadcrumbTrail
        items={[{ label: "Domínios", to: "/dominios" }, { label: domainName }]}
      />
      <div className="mb-1 flex items-center gap-2">
        <H2 className="text-xl font-semibold">{domainName}</H2>
        <Badge variant="info" className="font-mono">
          {code}
        </Badge>
      </div>
      <P className="mb-4 text-sm text-muted-foreground">
        Schemas do banco que usam este domínio de negócio
      </P>

      {schemas.isError ? (
        <QueryError error={schemas.error} fallback="Erro ao carregar o domínio." />
      ) : schemas.isPending ? (
        <ListSkeleton rows={3} />
      ) : doDominio.length === 0 ? (
        <P className="text-sm text-muted-foreground">
          Nenhum schema usa este domínio ainda.
        </P>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {doDominio.map((s) => (
            <SchemaCard key={s.schemaName} schema={s} />
          ))}
        </div>
      )}
    </div>
  )
}

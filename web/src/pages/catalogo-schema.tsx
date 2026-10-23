import { useMemo, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import {
  Input,
  P,
  Span,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  usePagination,
} from "@morlan/ui"
import { BreadcrumbTrail } from "@/components/breadcrumb-trail"
import { ListSkeleton, QueryError } from "@/components/query-feedback"
import { StatusBadge } from "@/components/status-badge"
import {
  useCatalogTables,
  useTableSaude,
} from "@/hooks/queries/catalog"
import { filterTables, TIPO_LABEL } from "@/utils/catalog"

/**
 * Saúde da tabela, calculada sob demanda: varre a tabela inteira no banco.
 * Como a listagem é paginada, só as linhas visíveis disparam a consulta — o que
 * limita, por construção, quantas varreduras correm ao mesmo tempo.
 */
function SaudeCell({ schema, table }: { schema: string; table: string }) {
  const { data, isPending } = useTableSaude(schema, table)
  if (isPending) return <Span variant="small">calculando...</Span>
  if (!data) return <Span variant="small">saúde: -</Span>
  return (
    <span className="flex items-center gap-1.5">
      <Span variant="muted">{data.saude.percentual}%</Span>
      <StatusBadge>{data.saude.classificacao}</StatusBadge>
    </span>
  )
}

export function CatalogoSchema() {
  const { schema = "" } = useParams()
  const [searchParams] = useSearchParams()
  const tipo = searchParams.get("tipo") // 'T' | 'V' | null (ambos)
  const tipoQuery = tipo ? `?tipo=${tipo}` : ""

  const [search, setSearch] = useState("")
  const tables = useCatalogTables(schema)
  const visible = useMemo(
    () => filterTables(tables.data ?? [], search, tipo),
    [tables.data, search, tipo]
  )
  const pagination = usePagination(visible)

  return (
    <div>
      <BreadcrumbTrail
        items={[{ label: "Catálogo", to: `/catalogo${tipoQuery}` }, { label: schema }]}
      />
      <P className="mb-4 text-sm text-muted-foreground">
        Tabelas e views do schema {schema}
        {tipo ? ` · somente ${TIPO_LABEL[tipo]?.toLowerCase()}s` : ""}
      </P>

      <Input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar tabela ou descrição..."
        aria-label="Buscar tabela"
        className="mb-4 max-w-sm"
      />

      {tables.isError ? (
        <QueryError error={tables.error} fallback="Erro ao carregar as tabelas." />
      ) : tables.isPending ? (
        <ListSkeleton />
      ) : (
        <Table
          pagination={{ ...pagination.paginationConfig, label: "tabelas" }}
          emptyState={<P>Nenhuma tabela encontrada.</P>}
        >
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Classificação</TableHead>
              <TableHead>Saúde dos dados</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.data.map((t) => (
              <TableRow key={t.name}>
                <TableCell>
                  <Link
                    to={`/catalogo/${schema}/${t.name}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {t.name}
                  </Link>
                </TableCell>
                <TableCell>{t.type}</TableCell>
                <TableCell>{t.description ?? "Sem descrição cadastrada"}</TableCell>
                <TableCell>
                  <StatusBadge>{t.classification}</StatusBadge>
                </TableCell>
                <TableCell>
                  <SaudeCell schema={schema} table={t.name} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

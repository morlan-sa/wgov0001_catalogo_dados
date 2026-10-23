import { useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import {
  Badge,
  H2,
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
import { useTableDetail } from "@/hooks/queries/catalog"
import { columnType } from "@/utils/catalog"

export function CatalogoTabela() {
  const { schema = "", table = "" } = useParams()
  const detail = useTableDetail(schema, table)
  const [search, setSearch] = useState("")

  const columns = useMemo(() => {
    const term = search.toLowerCase()
    return (detail.data?.columns ?? []).filter((c) =>
      c.name.toLowerCase().includes(term)
    )
  }, [detail.data, search])
  const pagination = usePagination(columns)

  const trail = (
    <BreadcrumbTrail
      items={[
        { label: "Catálogo", to: "/catalogo" },
        { label: schema, to: `/catalogo/${schema}` },
        { label: table },
      ]}
    />
  )

  if (detail.isError) {
    return (
      <div>
        {trail}
        <QueryError error={detail.error} fallback="Erro ao carregar a tabela." />
      </div>
    )
  }

  if (!detail.data) {
    return (
      <div>
        {trail}
        <ListSkeleton />
      </div>
    )
  }

  const d = detail.data

  return (
    <div>
      {trail}
      <div className="mb-1 flex items-center gap-2">
        <H2 className="text-xl font-semibold">
          {schema}.{table}
        </H2>
        <StatusBadge>{d.classification}</StatusBadge>
      </div>
      <P className="mb-1 text-sm text-muted-foreground">
        {d.description ?? "Sem descrição cadastrada"}
      </P>
      <div className="mb-4 flex items-center gap-2">
        {d.saude && d.totalRegistros !== null ? (
          <>
            <Span variant="small">
              {d.totalRegistros.toLocaleString("pt-BR")} registro(s)
            </Span>
            <Span variant="small">·</Span>
            <Span variant="small">Saúde dos dados: {d.saude.percentual}%</Span>
            <StatusBadge>{d.saude.classificacao}</StatusBadge>
          </>
        ) : (
          <Span variant="small">
            Sem permissão de leitura dos dados desta tabela — a saúde não pôde
            ser calculada.
          </Span>
        )}
      </div>

      <Input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar coluna..."
        aria-label="Buscar coluna"
        className="mb-4 max-w-sm"
      />

      <Table
        pagination={{ ...pagination.paginationConfig, label: "colunas" }}
        emptyState={<P>Nenhuma coluna encontrada.</P>}
      >
        <TableHeader>
          <TableRow>
            <TableHead>Coluna</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Domínio</TableHead>
            <TableHead>Nulo</TableHead>
            <TableHead>PK</TableHead>
            <TableHead>Completude</TableHead>
            <TableHead>Descrição</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagination.data.map((c) => (
            <TableRow key={c.name}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell>{columnType(c)}</TableCell>
              <TableCell>
                <Badge variant="neutral">{c.domain}</Badge>
              </TableCell>
              <TableCell>{c.nullable ? "Sim" : "Não"}</TableCell>
              <TableCell>{c.isPrimaryKey ? "Sim" : ""}</TableCell>
              <TableCell>
                {c.completude ? (
                  <span className="flex items-center gap-2">
                    <Span variant="muted">{c.completude.percentual}%</Span>
                    <StatusBadge>{c.completude.classificacao}</StatusBadge>
                  </span>
                ) : (
                  <Span variant="small">-</Span>
                )}
              </TableCell>
              <TableCell>{c.description ?? "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

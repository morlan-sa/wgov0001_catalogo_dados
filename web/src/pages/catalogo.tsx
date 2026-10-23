import { useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
  Input,
  P,
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
import { useColumnSearch } from "@/hooks/queries/catalog"
import { useCatalogSchemas, type Schema } from "@/hooks/queries/schemas"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { filterSchemas } from "@/utils/catalog"

const COLUMN_SEARCH_DEBOUNCE_MS = 300
// Precisa acompanhar CATALOG_COLUMN_SEARCH_LIMIT do BFF (server/.env).
const COLUMN_SEARCH_LIMIT = Number(import.meta.env.VITE_COLUMN_SEARCH_LIMIT ?? 200)

const SUBTITLE_BY_TIPO: Record<string, string> = {
  T: "Schemas com tabelas catalogadas no banco de dados",
  V: "Schemas com views catalogadas no banco de dados",
}
const DEFAULT_SUBTITLE = "Schemas e tabelas catalogados no banco de dados"

function countsLabel(s: Schema, tipo: string | null): string {
  if (tipo === "T") return `${s.tableCount} tabelas`
  if (tipo === "V") return `${s.viewCount} views`
  return `${s.tableCount} tabelas · ${s.viewCount} views`
}

function SchemasTable({
  schemas,
  tipo,
}: {
  schemas: Schema[]
  tipo: string | null
}) {
  const pagination = usePagination(schemas)
  const tipoQuery = tipo ? `?tipo=${tipo}` : ""

  return (
    <Table
      pagination={{ ...pagination.paginationConfig, label: "schemas" }}
      emptyState={<P>Nenhum schema encontrado.</P>}
    >
      <TableHeader>
        <TableRow>
          <TableHead>Schema</TableHead>
          <TableHead>Objetos</TableHead>
          <TableHead>Camada</TableHead>
          <TableHead>Domínio</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pagination.data.map((s) => (
          <TableRow key={s.schemaName}>
            <TableCell>
              <Link
                to={`/catalogo/${s.schemaName}${tipoQuery}`}
                className="font-semibold text-primary hover:underline"
              >
                {s.schemaName}
              </Link>
            </TableCell>
            <TableCell>{countsLabel(s, tipo)}</TableCell>
            <TableCell>{s.camada}</TableCell>
            <TableCell>{s.dominio.name}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ColumnResults({
  term,
  filter,
}: {
  term: string
  filter: string[] | null
}) {
  const { data, isFetching, isError, error } = useColumnSearch(term, filter)
  const results = data ?? []
  const pagination = usePagination(results)

  if (isError) return <QueryError error={error} fallback="Erro ao buscar colunas." />
  if (isFetching && !data) return <ListSkeleton rows={4} />

  return (
    <div className="space-y-2">
      {results.length >= COLUMN_SEARCH_LIMIT && (
        <P className="text-xs text-muted-foreground">
          Mostrando os primeiros {COLUMN_SEARCH_LIMIT} resultados — refine sua
          busca para ver menos itens.
        </P>
      )}
      <Table
        pagination={{ ...pagination.paginationConfig, label: "colunas" }}
        emptyState={<P>Nenhuma coluna encontrada para "{term}".</P>}
      >
        <TableHeader>
          <TableRow>
            <TableHead>Coluna</TableHead>
            <TableHead>Tabela</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Descrição</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagination.data.map((r) => (
            <TableRow key={`${r.schemaName}.${r.table}.${r.column}`}>
              <TableCell className="font-medium">{r.column}</TableCell>
              <TableCell>
                <Link
                  to={`/catalogo/${r.schemaName}/${r.table}`}
                  className="text-primary hover:underline"
                >
                  {r.schemaName}.{r.table}
                </Link>
              </TableCell>
              <TableCell>{r.type}</TableCell>
              <TableCell>{r.description ?? "Sem descrição cadastrada"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function Catalogo() {
  const [searchParams] = useSearchParams()
  const filterParam = searchParams.get("filter")
  const filter = useMemo(
    () => (filterParam ? filterParam.split(",").filter(Boolean) : null),
    [filterParam]
  )
  const tipo = searchParams.get("tipo") // 'T' | 'V' | null (ambos)

  const [search, setSearch] = useState("")
  const [columnSearch, setColumnSearch] = useState("")
  const debouncedColumnSearch = useDebouncedValue(
    columnSearch,
    COLUMN_SEARCH_DEBOUNCE_MS
  )
  const schemas = useCatalogSchemas(filter)

  const visible = useMemo(
    () => filterSchemas(schemas.data ?? [], search, tipo),
    [schemas.data, search, tipo]
  )
  const isSearchingColumns = debouncedColumnSearch.trim().length > 0

  return (
    <div>
      <BreadcrumbTrail items={[{ label: "Catálogo" }]} />
      <P className="mb-4 text-sm text-muted-foreground">
        {(tipo && SUBTITLE_BY_TIPO[tipo]) || DEFAULT_SUBTITLE}
      </P>

      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar schema..."
          aria-label="Buscar schema"
          className="max-w-sm min-w-[220px] flex-1"
        />
        <Input
          type="search"
          value={columnSearch}
          onChange={(e) => setColumnSearch(e.target.value)}
          placeholder="Buscar coluna em todas as tabelas..."
          aria-label="Buscar coluna em todas as tabelas"
          className="max-w-sm min-w-[220px] flex-1"
        />
      </div>

      {isSearchingColumns ? (
        <ColumnResults term={debouncedColumnSearch} filter={filter} />
      ) : schemas.isError ? (
        <QueryError error={schemas.error} fallback="Erro ao carregar o catálogo." />
      ) : schemas.isPending ? (
        <ListSkeleton />
      ) : (
        <SchemasTable schemas={visible} tipo={tipo} />
      )}
    </div>
  )
}

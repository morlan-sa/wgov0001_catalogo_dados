import { useMemo, useState } from "react"
import {
  Badge,
  Input,
  P,
  Span,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@morlan/ui"
import { BreadcrumbTrail } from "@/components/breadcrumb-trail"
import { ListSkeleton, QueryError } from "@/components/query-feedback"
import { ValidadorNome } from "@/components/validador-nome"
import { useNomenclatura, type Nomenclatura as Regras } from "@/hooks/queries/nomenclatura"

/** "2026-08-04" -> "04/08/2026"; qualquer outro formato volta como veio. */
function formatarData(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

function TabelaPrefixos({ prefixos }: { prefixos: Regras["prefixos"] }) {
  const [filtro, setFiltro] = useState("")
  const visiveis = useMemo(() => {
    const termo = filtro.trim().toLowerCase()
    return prefixos.filter(
      (p) =>
        p.codigo.toLowerCase().includes(termo) ||
        p.significado.toLowerCase().includes(termo)
    )
  }, [prefixos, filtro])

  return (
    <>
      <Input
        type="search"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder="Filtrar por código ou significado..."
        aria-label="Filtrar prefixos"
        className="mb-4 max-w-sm"
      />
      <Table emptyState={<P>Nenhum prefixo encontrado.</P>}>
        <TableHeader>
          <TableRow>
            <TableHead>Prefixo</TableHead>
            <TableHead>Significado</TableHead>
            <TableHead>Domínios de tipo</TableHead>
            <TableHead>Exemplo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visiveis.map((p) => (
            <TableRow key={p.codigo}>
              <TableCell className="font-mono font-medium">{p.codigo}</TableCell>
              <TableCell>{p.significado}</TableCell>
              <TableCell>
                <span className="flex flex-wrap gap-1">
                  {p.dominios.map((d) => (
                    <Badge key={d} variant="neutral" className="font-mono">
                      {d}
                    </Badge>
                  ))}
                </span>
              </TableCell>
              <TableCell>{p.exemplo}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}

function TabelaDominiosTipo({ dominios }: { dominios: Regras["dominiosTipo"] }) {
  return (
    <Table emptyState={<P>Nenhum domínio de tipo cadastrado.</P>}>
      <TableHeader>
        <TableRow>
          <TableHead>Código</TableHead>
          <TableHead>Descrição</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Escala</TableHead>
          <TableHead>Nulo</TableHead>
          <TableHead>Exemplo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {dominios.map((d) => (
          <TableRow key={d.codigo}>
            <TableCell className="font-mono font-medium">{d.codigo}</TableCell>
            <TableCell>{d.descricao}</TableCell>
            <TableCell>{d.tipo}</TableCell>
            <TableCell>{d.escala ?? "-"}</TableCell>
            <TableCell>{d.nulo ? "Sim" : "Não"}</TableCell>
            <TableCell className="font-mono">{d.exemplo}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function TabelaDominiosNegocio({ dominios }: { dominios: Regras["dominiosNegocio"] }) {
  return (
    <Table emptyState={<P>Nenhum domínio de negócio cadastrado.</P>}>
      <TableHeader>
        <TableRow>
          <TableHead>Código</TableHead>
          <TableHead>Nome</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {dominios.map((d) => (
          <TableRow key={d.codigo}>
            <TableCell className="font-mono font-medium">{d.codigo}</TableCell>
            <TableCell>{d.nome}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function NomeDeSchema({ camadas }: { camadas: string[] }) {
  return (
    <div className="max-w-2xl space-y-3">
      <P>
        O nome de um schema governado é composto pela camada e pelo domínio de
        negócio: <Span className="font-mono font-semibold">{"<CAMADA>_<DOMÍNIO>"}</Span>{" "}
        (por exemplo, <Span className="font-mono">CUR_COM</Span>). Os domínios
        de negócio válidos estão na aba "Domínios de negócio".
      </P>
      <div className="flex flex-wrap items-center gap-2">
        <Span variant="muted">Camadas:</Span>
        {camadas.map((c) => (
          <Badge key={c} variant="info" className="font-mono">
            {c}
          </Badge>
        ))}
      </div>
    </div>
  )
}

function CasosAmbiguos({ ambiguidades }: { ambiguidades: Regras["ambiguidades"] }) {
  if (ambiguidades.length === 0) return <P>Nenhum caso ambíguo cadastrado.</P>
  return (
    <ul className="space-y-3">
      {ambiguidades.map((a) => (
        <li key={a.termos.join("|")} className="rounded-md border p-3">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Span variant="muted">Termos:</Span>
            {a.termos.map((t) => (
              <Badge key={t} variant="neutral">
                {t}
              </Badge>
            ))}
          </div>
          <P className="mb-1 text-sm font-medium">{a.pergunta}</P>
          <div className="flex flex-wrap items-center gap-2">
            <Span variant="muted">Opções:</Span>
            {a.opcoes.map((o) => (
              <Badge key={o} variant="info">
                {o}
              </Badge>
            ))}
          </div>
        </li>
      ))}
    </ul>
  )
}

export function Nomenclatura() {
  const regras = useNomenclatura()
  const trail = <BreadcrumbTrail items={[{ label: "Nomenclatura" }]} />

  if (regras.isError) {
    return (
      <div>
        {trail}
        <QueryError error={regras.error} fallback="Erro ao carregar os padrões de nomenclatura." />
      </div>
    )
  }

  if (!regras.data) {
    return (
      <div>
        {trail}
        <ListSkeleton />
      </div>
    )
  }

  const d = regras.data

  return (
    <div>
      {trail}
      <P className="mb-4 text-sm text-muted-foreground">
        Padrões corporativos de nomenclatura e tipagem de colunas, tabelas e
        schemas
      </P>

      <ValidadorNome dominiosTipo={d.dominiosTipo} />

      <Tabs defaultValue="prefixos">
        <TabsList>
          <TabsTrigger value="prefixos">Prefixos</TabsTrigger>
          <TabsTrigger value="dominios-tipo">Domínios de tipo</TabsTrigger>
          <TabsTrigger value="dominios-negocio">Domínios de negócio</TabsTrigger>
          <TabsTrigger value="schema">Nome de schema</TabsTrigger>
          <TabsTrigger value="ambiguos">Casos ambíguos</TabsTrigger>
        </TabsList>
        <TabsContent value="prefixos" className="pt-4">
          <TabelaPrefixos prefixos={d.prefixos} />
        </TabsContent>
        <TabsContent value="dominios-tipo" className="pt-4">
          <TabelaDominiosTipo dominios={d.dominiosTipo} />
        </TabsContent>
        <TabsContent value="dominios-negocio" className="pt-4">
          <TabelaDominiosNegocio dominios={d.dominiosNegocio} />
        </TabsContent>
        <TabsContent value="schema" className="pt-4">
          <NomeDeSchema camadas={d.camadas} />
        </TabsContent>
        <TabsContent value="ambiguos" className="pt-4">
          <CasosAmbiguos ambiguidades={d.ambiguidades} />
        </TabsContent>
      </Tabs>

      <P className="mt-6 text-xs text-muted-foreground">
        Fonte: {d.fonte} v{d.versao} ({formatarData(d.dataFonte)})
      </P>
    </div>
  )
}

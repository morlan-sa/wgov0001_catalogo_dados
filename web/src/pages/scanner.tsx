import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ButtonList,
  Card,
  Checkbox,
  Input,
  P,
  Span,
  Stepper,
  StepperContent,
  StepperFooter,
  StepperHeader,
  useStepper,
} from "@morlan/ui"
import { MnemonicLabel } from "@/components/mnemonic-label"
import { ListSkeleton, QueryError } from "@/components/query-feedback"
import { useSchemas, type Schema } from "@/hooks/queries/schemas"
import { schemasDoAtalho, type Atalho } from "@/utils/catalog"

const STEPS = [
  { label: "Escolha o grupo" },
  { label: "Confirme a seleção" },
]

function EscolhaDoGrupo({
  schemas,
  onChoose,
}: {
  schemas: Schema[]
  onChoose: (atalho: Atalho) => void
}) {
  const { next } = useStepper()
  const opcoes: { atalho: Atalho; titulo: string; detalhe: string }[] = [
    {
      atalho: "governadas",
      titulo: "Schemas governados",
      detalhe: "STG_ / CUR_ / RPT_",
    },
    {
      atalho: "todas",
      titulo: "Todos os schemas",
      detalhe: `${schemas.length} schemas`,
    },
    {
      atalho: "manual",
      titulo: "Escolher manualmente",
      detalhe: "Selecionar schema a schema",
    },
  ]

  return (
    <div className="max-w-md space-y-3">
      {opcoes.map((o) => (
        <button
          key={o.atalho}
          type="button"
          onClick={() => {
            onChoose(o.atalho)
            next()
          }}
          className="w-full cursor-pointer text-left"
        >
          <Card className="p-3 transition-colors hover:border-primary">
            <P className="font-semibold text-primary">{o.titulo}</P>
            <Span variant="muted">{o.detalhe}</Span>
          </Card>
        </button>
      ))}
    </div>
  )
}

function ConfirmaSelecao({
  schemas,
  selected,
  onToggle,
}: {
  schemas: Schema[]
  selected: Set<string>
  onToggle: (schemaName: string) => void
}) {
  const { prev } = useStepper()
  const navigate = useNavigate()
  const [filterText, setFilterText] = useState("")

  const visible = schemas.filter((s) =>
    s.schemaName.toLowerCase().includes(filterText.toLowerCase())
  )

  return (
    <div className="max-w-md">
      <Input
        type="search"
        value={filterText}
        onChange={(e) => setFilterText(e.target.value)}
        placeholder="Filtrar schema"
        aria-label="Filtrar schema"
        className="mb-2"
      />
      <Card className="max-h-72 space-y-1 overflow-y-auto p-2">
        {visible.map((s) => (
          <div key={s.schemaName} className="flex items-center gap-2 px-2 py-1">
            <Checkbox
              id={`schema-${s.schemaName}`}
              label={s.schemaName}
              checked={selected.has(s.schemaName)}
              onCheckedChange={() => onToggle(s.schemaName)}
            />
            <Span variant="small" className="ml-auto">
              {s.tableCount} tabelas · {s.viewCount} views
            </Span>
          </div>
        ))}
      </Card>

      <StepperFooter className="mt-3">
        <ButtonList
          hotkeyMod="alt"
          buttons={[
            {
              children: <MnemonicLabel>Voltar</MnemonicLabel>,
              hotkey: "v",
              variant: "ghost",
              onClick: prev,
            },
            {
              children: (
                <>
                  <MnemonicLabel>Consultar</MnemonicLabel> ({selected.size}{" "}
                  schemas)
                </>
              ),
              hotkey: "c",
              disabled: selected.size === 0,
              onClick: () =>
                navigate(`/catalogo?filter=${Array.from(selected).join(",")}`),
            },
          ]}
          className="gap-2"
        />
      </StepperFooter>
    </div>
  )
}

export function Scanner() {
  const schemas = useSchemas()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const lista = useMemo(() => schemas.data ?? [], [schemas.data])

  function toggle(schemaName: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(schemaName)) next.delete(schemaName)
      else next.add(schemaName)
      return next
    })
  }

  if (schemas.isError) {
    return <QueryError error={schemas.error} fallback="Erro ao carregar os schemas." />
  }
  if (schemas.isPending) return <ListSkeleton rows={3} />

  return (
    <div>
      <P className="mb-6 text-sm text-muted-foreground">
        Escolha quais schemas do banco explorar no catálogo
      </P>
      <Stepper>
        <StepperHeader steps={STEPS} className="mb-2 max-w-md" />
        <StepperContent step={0}>
          <EscolhaDoGrupo
            schemas={lista}
            onChoose={(atalho) => setSelected(schemasDoAtalho(atalho, lista))}
          />
        </StepperContent>
        <StepperContent step={1}>
          <ConfirmaSelecao schemas={lista} selected={selected} onToggle={toggle} />
        </StepperContent>
      </Stepper>
    </div>
  )
}

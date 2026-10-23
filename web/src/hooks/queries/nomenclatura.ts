// Consome `server/app/features/nomenclatura/`: regras de nomenclatura e
// validação de nomes de coluna. Também é a casa dos tipos de conformidade e
// documentação que o catálogo reaproveita (`catalog.ts` importa daqui).
// Tipo "raw" espelha o JSON do BFF (snake_case); o tipo local é camelCase.
import { useMutation, useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"

// --- Tipos compartilhados com o catálogo ------------------------------------

export type ResultadoAvaliacao = "conforme" | "aviso" | "fora"

export interface Sugestao {
  nome: string | null
  dominio: string | null
  tipo: string | null
  nulo: boolean | null
}

export interface Avaliacao {
  resultado: ResultadoAvaliacao
  problemas: string[]
  sugestao: Sugestao | null
}

export interface Conformidade {
  aplicavel: boolean
  conformes: number
  avisos: number
  fora: number
  total: number
  percentual: number | null
  // conformes + peso * avisos, calculado no backend (o peso é configurável).
  pontos: number
}

export interface Documentacao {
  percentual: number | null
  documentadas: number
  total: number
}

// Os campos acima têm a mesma grafia no JSON (palavras simples), então o raw
// é o próprio tipo local; os mappers existem para devolver cópias desacopladas.
export type SugestaoRaw = Sugestao
export type AvaliacaoRaw = Avaliacao
export type ConformidadeRaw = Conformidade
export type DocumentacaoRaw = Documentacao

export function mapAvaliacao(raw: AvaliacaoRaw): Avaliacao {
  return {
    resultado: raw.resultado,
    problemas: [...raw.problemas],
    sugestao: raw.sugestao ? { ...raw.sugestao } : null,
  }
}

export function mapConformidade(raw: ConformidadeRaw): Conformidade {
  return {
    aplicavel: raw.aplicavel,
    conformes: raw.conformes,
    avisos: raw.avisos,
    fora: raw.fora,
    total: raw.total,
    percentual: raw.percentual,
    pontos: raw.pontos,
  }
}

export function mapDocumentacao(raw: DocumentacaoRaw): Documentacao {
  return {
    percentual: raw.percentual,
    documentadas: raw.documentadas,
    total: raw.total,
  }
}

// --- Regras de nomenclatura -------------------------------------------------

interface PrefixoRaw {
  codigo: string
  significado: string
  exemplo: string
  dominios: string[]
}

interface DominioTipoRaw {
  codigo: string
  descricao: string
  tipo: string
  escala: string | null
  nulo: boolean
  exemplo: string
}

interface DominioNegocioRaw {
  codigo: string
  nome: string
}

interface AmbiguidadeRaw {
  termos: string[]
  opcoes: string[]
  pergunta: string
}

interface NomenclaturaRaw {
  fonte: string
  versao: string
  data_fonte: string
  prefixos: PrefixoRaw[]
  dominios_tipo: DominioTipoRaw[]
  dominios_negocio: DominioNegocioRaw[]
  camadas: string[]
  ambiguidades: AmbiguidadeRaw[]
}

export type Prefixo = PrefixoRaw
export type DominioTipo = DominioTipoRaw
export type DominioNegocio = DominioNegocioRaw
export type Ambiguidade = AmbiguidadeRaw

export interface Nomenclatura {
  fonte: string
  versao: string
  dataFonte: string
  prefixos: Prefixo[]
  dominiosTipo: DominioTipo[]
  dominiosNegocio: DominioNegocio[]
  camadas: string[]
  ambiguidades: Ambiguidade[]
}

function mapAmbiguidade(raw: AmbiguidadeRaw): Ambiguidade {
  return { termos: [...raw.termos], opcoes: [...raw.opcoes], pergunta: raw.pergunta }
}

export function mapNomenclatura(raw: NomenclaturaRaw): Nomenclatura {
  return {
    fonte: raw.fonte,
    versao: raw.versao,
    dataFonte: raw.data_fonte,
    prefixos: raw.prefixos.map((p) => ({ ...p, dominios: [...p.dominios] })),
    dominiosTipo: raw.dominios_tipo.map((d) => ({ ...d })),
    dominiosNegocio: raw.dominios_negocio.map((d) => ({ ...d })),
    camadas: [...raw.camadas],
    ambiguidades: raw.ambiguidades.map(mapAmbiguidade),
  }
}

// --- Validação de nome ------------------------------------------------------

interface ValidacaoRaw extends AvaliacaoRaw {
  nome: string
  ambiguidade: AmbiguidadeRaw | null
  dominios_candidatos: string[]
}

export interface Validacao extends Avaliacao {
  nome: string
  ambiguidade: Ambiguidade | null
  dominiosCandidatos: string[]
}

export interface ValidarNomeInput {
  nome: string
  tipo?: string
  tamanho?: number
}

export function mapValidacao(raw: ValidacaoRaw): Validacao {
  return {
    ...mapAvaliacao(raw),
    nome: raw.nome,
    ambiguidade: raw.ambiguidade ? mapAmbiguidade(raw.ambiguidade) : null,
    dominiosCandidatos: [...raw.dominios_candidatos],
  }
}

// --- Hooks ------------------------------------------------------------------

/** Regras vigentes de nomenclatura; mudam raramente, então cache longo. */
export function useNomenclatura() {
  return useQuery({
    queryKey: ["nomenclatura"],
    queryFn: async () => {
      const res = await api.get("/nomenclatura")
      return mapNomenclatura(res.data as NomenclaturaRaw)
    },
    staleTime: 60 * 60 * 1000,
  })
}

/** Valida um nome de coluna (e, opcionalmente, tipo/tamanho) contra as regras. */
export function useValidarNome() {
  return useMutation({
    mutationFn: async (input: ValidarNomeInput) => {
      const res = await api.post("/nomenclatura/validar", input)
      return mapValidacao(res.data as ValidacaoRaw)
    },
  })
}

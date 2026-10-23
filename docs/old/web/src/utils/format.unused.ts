// Funções do template (utils/format.ts) que nenhuma tela deste app usa.
// Para reaproveitar, copie de volta para web/src/utils/format.ts.

export function formatDateTime(iso: string | undefined) {
  if (!iso) return ""
  return new Date(iso).toLocaleString("pt-BR")
}

export function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" })
}

export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function keysOf<T extends Record<string, unknown>>(o: T) {
  return Object.keys(o) as (keyof T & string)[]
}

/** Constrói `{ label, value }[]` onde label === value. */
export function identityOptions(values: readonly string[]) {
  return values.map((v) => ({ label: v, value: v }))
}

export function displayCNPJ(digits: string) {
  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  )
}

export function displayCPF(digits: string) {
  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")
}

export function formatDocument(value: string | null) {
  if (!value) return null
  const digits = value.replace(/\D/g, "")

  if (digits.length === 14) {
    return displayCNPJ(digits)
  }

  if (digits.length === 11) {
    return displayCPF(digits)
  }

  return digits
}

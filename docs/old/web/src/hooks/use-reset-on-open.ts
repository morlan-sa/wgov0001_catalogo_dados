import { useState } from "react"

/**
 * Dispara `reset()` quando `isOpen` transiciona de `false` para `true`.
 *
 * Encapsula o padrão repetido em modais/sheets que hidratam state a partir
 * de `editing` toda vez que abrem. Usa o pattern "set state during render"
 * — válido em React 18+ e mais barato que um efeito.
 */
export function useResetOnOpen(isOpen: boolean, reset: () => void) {
  const [prevIsOpen, setPrevIsOpen] = useState(false)
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen)
    if (isOpen) reset()
  }
}

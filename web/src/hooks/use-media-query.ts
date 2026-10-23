import { useEffect, useState } from "react"

/**
 * Assina uma media query nativa via `matchMedia` — reavalia em toda
 * mudança de viewport (resize, rotação, DevTools). Sem dependência nova;
 * `@morlan/ui` não exporta nada equivalente.
 */
export function useMediaQuery(query: string): boolean {
  // Recomputa durante o render se `query` mudou desde o último — mesmo
  // padrão de `useResetOnOpen` (set state during render, válido em React
  // 18+) — em vez de sincronizar via `setState` direto no corpo do efeito.
  const [trackedQuery, setTrackedQuery] = useState(query)
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  if (query !== trackedQuery) {
    setTrackedQuery(query)
    setMatches(window.matchMedia(query).matches)
  }

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [query])

  return matches
}

// Breakpoints padrão do Tailwind (sem override em `@theme` — ver
// node_modules/@morlan/ui/dist/styles.css).
const BREAKPOINTS = {
  md: 768,
  lg: 1024,
} as const

/**
 * `true` quando o viewport está ABAIXO do breakpoint informado — nomeado
 * pelo caso de uso mais comum ("estou em telas pequenas?") em vez do
 * media-query cru.
 */
export function useIsBelowBreakpoint(
  breakpoint: keyof typeof BREAKPOINTS
): boolean {
  return useMediaQuery(`(max-width: ${BREAKPOINTS[breakpoint] - 1}px)`)
}

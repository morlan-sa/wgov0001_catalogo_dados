/**
 * Rótulo de botão com a primeira letra destacada (I̲ncluir, A̲lterar…) — o
 * mnemônico do atalho `Alt`+letra definido na norma de telas da Morlan.
 *
 * O acionamento por teclado vem do `ButtonList`/`Button` da `@morlan/ui`
 * (`hotkey` + `hotkeyMod="alt"`); o destaque visual da letra ainda não existe
 * na lib. Este componente é o desbloqueio de agora — o destaque é padrão
 * visual e deve migrar para a `@morlan/ui` (demanda aberta, ver README).
 */
export function MnemonicLabel({ children }: { children: string }) {
  const [first, ...rest] = children
  return (
    <>
      <u>{first}</u>
      {rest.join("")}
    </>
  )
}

import { useEffect, useState, type ReactNode } from "react"
import { fetchMe, logout as ssoLogout, type AuthUser } from "@morlan/access-web"
import { SessaoContext } from "./sessao-context"

/**
 * "Seu próprio hook" que a lib de auth espera de cada app consumidor (ver
 * README de `@morlan/access-web`: "o app já sabe checar /me... só delega o
 * que fazer quando não há sessão"). A lib nunca renderiza uma tela de login
 * própria — isso é papel do Keycloak, via `login()`.
 *
 * Um único `fetchMe()` por carregamento de página, compartilhado via
 * contexto — sem isto, `App` (para `RequereAutenticacao`) e `UserPopover`
 * (para nome/e-mail) cada um chamaria `/me` por conta própria.
 */
export function SessaoProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [autenticado, setAutenticado] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false

    fetchMe()
      .then((u) => {
        if (cancelled) return
        setUser(u)
        setAutenticado(u !== null)
      })
      .catch((err) => {
        // `fetchMe()` só resolve `null` num 401 limpo — qualquer outra falha
        // (backend fora do ar, proxy/CORS mal configurado, etc.) rejeita.
        // Fail-closed: trata como não-autenticado em vez de travar a UI para
        // sempre na tela de "Validando login...".
        if (cancelled) return
        console.error("Falha ao consultar /me:", err)
        setUser(null)
        setAutenticado(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function logout() {
    // `ssoLogout()` deve rodar (e, se houver `logout_url`, navegar ao Keycloak)
    // ANTES de zerar o estado local: `autenticado=false` dispara o
    // `aoNaoAutenticado`/`login()` do <RequereAutenticacao> em App.tsx (guard
    // reativo em toda a rota), que navegaria para /api/auth/login primeiro e
    // cancelaria o redirect de RP-Initiated Logout — a sessão SSO do Keycloak
    // ficaria viva e o /login relogaria sozinho, sem pedir credenciais.
    await ssoLogout()
    setUser(null)
    setAutenticado(false)
  }

  return (
    <SessaoContext.Provider value={{ user, autenticado, logout }}>
      {children}
    </SessaoContext.Provider>
  )
}

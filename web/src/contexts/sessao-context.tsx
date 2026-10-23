import { createContext } from "react"
import type { AuthUser } from "@morlan/access-web"

export interface SessaoContextValue {
  user: AuthUser | null
  /** `null` enquanto `fetchMe()` ainda está em voo — contrato esperado pela
   * prop `autenticado` de `RequereAutenticacao` (@morlan/access-web/react). */
  autenticado: boolean | null
  /** Encerra a sessão BFF (e, se veio do Keycloak, o SSO no provedor) e
   * atualiza `user`/`autenticado` — ver `@morlan/access-web`'s `logout()`. */
  logout: () => Promise<void>
}

export const SessaoContext = createContext<SessaoContextValue | null>(null)

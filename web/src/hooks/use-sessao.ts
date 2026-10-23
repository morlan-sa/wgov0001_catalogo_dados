import { useContext } from "react"
import {
  SessaoContext,
  type SessaoContextValue,
} from "@/contexts/sessao-context"

export function useSessao(): SessaoContextValue {
  const ctx = useContext(SessaoContext)
  if (!ctx) throw new Error("useSessao must be used within SessaoProvider")
  return ctx
}

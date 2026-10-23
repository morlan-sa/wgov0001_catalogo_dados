// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import { SessaoProvider } from "@/contexts/sessao-provider"
import { useSessao } from "@/hooks/use-sessao"
import { fetchMe, logout } from "@morlan/access-web"

vi.mock("@morlan/access-web", () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
}))

const fetchMeMock = vi.mocked(fetchMe)
const logoutMock = vi.mocked(logout)

beforeEach(() => {
  fetchMeMock.mockReset()
  logoutMock.mockReset()
})

describe("SessaoProvider / useSessao", () => {
  it("starts with autenticado === null while fetchMe() is in flight", () => {
    fetchMeMock.mockReturnValue(new Promise(() => {})) // nunca resolve
    const { result } = renderHook(() => useSessao(), {
      wrapper: SessaoProvider,
    })

    expect(result.current.autenticado).toBeNull()
    expect(result.current.user).toBeNull()
  })

  it("resolves autenticado=true with the user when fetchMe() finds a session", async () => {
    fetchMeMock.mockResolvedValue({
      usuario: "usuario.teste",
      nome: "Usuário Teste",
      email: "usuario.teste@morlan.com.br",
      roles: ["usuario"],
    })
    const { result } = renderHook(() => useSessao(), {
      wrapper: SessaoProvider,
    })

    await waitFor(() => expect(result.current.autenticado).toBe(true))
    expect(result.current.user?.usuario).toBe("usuario.teste")
  })

  it("resolves autenticado=false when fetchMe() finds no session", async () => {
    fetchMeMock.mockResolvedValue(null)
    const { result } = renderHook(() => useSessao(), {
      wrapper: SessaoProvider,
    })

    await waitFor(() => expect(result.current.autenticado).toBe(false))
    expect(result.current.user).toBeNull()
  })

  it("resolves autenticado=false (fail-closed) when fetchMe() rejects", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    fetchMeMock.mockRejectedValue(new Error("auth/me falhou: 500"))
    const { result } = renderHook(() => useSessao(), {
      wrapper: SessaoProvider,
    })

    await waitFor(() => expect(result.current.autenticado).toBe(false))
    expect(result.current.user).toBeNull()
    consoleError.mockRestore()
  })

  it("throws when used outside SessaoProvider", () => {
    expect(() => renderHook(() => useSessao())).toThrow(
      "useSessao must be used within SessaoProvider"
    )
  })

  it("clears user/autenticado after logout() resolves", async () => {
    fetchMeMock.mockResolvedValue({
      usuario: "usuario.teste",
      nome: "Usuário Teste",
      email: "usuario.teste@morlan.com.br",
      roles: ["usuario"],
    })
    logoutMock.mockResolvedValue(true)
    const { result } = renderHook(() => useSessao(), {
      wrapper: SessaoProvider,
    })

    await waitFor(() => expect(result.current.autenticado).toBe(true))

    await act(async () => {
      await result.current.logout()
    })

    expect(logoutMock).toHaveBeenCalled()
    expect(result.current.autenticado).toBe(false)
    expect(result.current.user).toBeNull()
  })
})

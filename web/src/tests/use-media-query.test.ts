// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useIsBelowBreakpoint, useMediaQuery } from "@/hooks/use-media-query"

class FakeMediaQueryList {
  matches: boolean
  private listeners: Array<(e: MediaQueryListEvent) => void> = []

  constructor(
    public media: string,
    initialMatches: boolean
  ) {
    this.matches = initialMatches
  }

  addEventListener(
    _type: "change",
    listener: (e: MediaQueryListEvent) => void
  ) {
    this.listeners.push(listener)
  }

  removeEventListener(
    _type: "change",
    listener: (e: MediaQueryListEvent) => void
  ) {
    this.listeners = this.listeners.filter((l) => l !== listener)
  }

  emit(matches: boolean) {
    this.matches = matches
    for (const listener of this.listeners) {
      listener({ matches } as MediaQueryListEvent)
    }
  }
}

function mockMatchMedia(initialMatches: boolean) {
  // jsdom não implementa `matchMedia` — não há função pré-existente para
  // `vi.spyOn` interceptar, então atribuímos diretamente.
  const mql = new FakeMediaQueryList("", initialMatches)
  window.matchMedia = vi.fn(() => mql as unknown as MediaQueryList)
  return mql
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("useMediaQuery", () => {
  it("returns the initial match state", () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useMediaQuery("(max-width: 767px)"))
    expect(result.current).toBe(true)
  })

  it("updates when the media query change event fires", () => {
    const mql = mockMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery("(max-width: 767px)"))
    expect(result.current).toBe(false)

    act(() => mql.emit(true))
    expect(result.current).toBe(true)
  })

  it("stops listening after unmount", () => {
    const mql = mockMatchMedia(false)
    const { unmount } = renderHook(() => useMediaQuery("(max-width: 767px)"))
    unmount()
    act(() => mql.emit(true)) // sem listener restante — não deveria lançar erro
  })
})

describe("useIsBelowBreakpoint", () => {
  it("queries max-width one pixel below the md breakpoint", () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useIsBelowBreakpoint("md"))
    expect(result.current).toBe(true)
    expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 767px)")
  })

  it("queries max-width one pixel below the lg breakpoint", () => {
    mockMatchMedia(false)
    renderHook(() => useIsBelowBreakpoint("lg"))
    expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 1023px)")
  })
})

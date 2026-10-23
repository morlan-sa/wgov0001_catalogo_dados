import { H1 } from "@morlan/ui"
import { Outlet, useMatches } from "react-router-dom"
import { Navbar } from "@/components/navbar"
import type { RouteHandle } from "@/types"
import { UserPopover } from "@/components/user-popover"

export function AppLayout() {
  const matches = useMatches()
  const currentMatch = matches[matches.length - 1]
  const title = (currentMatch?.handle as RouteHandle)?.title

  return (
    <div className="flex h-screen flex-col overflow-hidden md:flex-row">
      <Navbar />
      <main className="flex flex-1 justify-center overflow-y-auto p-5">
        <div className="w-full max-w-[1440px]">
          <header className="mb-7 flex shrink-0 items-center justify-between border-b pb-3">
            {title && <H1>{title}</H1>}
            <UserPopover />
          </header>
          <Outlet />
        </div>
      </main>
    </div>
  )
}

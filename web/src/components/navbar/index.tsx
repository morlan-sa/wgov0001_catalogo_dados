import { memo, useCallback, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  BookOpen01Icon,
  Cancel01Icon,
  DashboardSquare01Icon,
  Layers01Icon,
  Menu01Icon,
  ScanIcon,
  SpellCheckIcon,
} from "@hugeicons/core-free-icons"
import {
  Sidebar as SidebarRoot,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  Logo,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
  Button,
} from "@morlan/ui"
import { useIsBelowBreakpoint } from "@/hooks/use-media-query"
import { NavItem } from "./nav-item"

/**
 * Shell de navegação genérico — sem gate de permissão (o RBAC completo do
 * projeto de origem foi deixado de fora deste template). Adicione itens à
 * lista abaixo conforme as rotas reais do seu projeto; se precisar de
 * grupos/submenus condicionados a permissão, veja o padrão de
 * `useMenuAccess` + `NavSubmenu` em rnc2/web como referência.
 */
export const Navbar = memo(function Navbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const isMobile = useIsBelowBreakpoint("md")
  const [mobileOpen, setMobileOpen] = useState(false)
  const handleNavigate = useCallback(
    (value: string) => {
      navigate(value)
      setMobileOpen(false)
    },
    [navigate]
  )

  const navMenuContent = (
    <>
      <SidebarHeader className="flex items-center justify-center pt-4">
        <Logo size="xl" variant="nobg" />
      </SidebarHeader>

      <SidebarContent className="overflow-x-hidden">
        <SidebarGroup>
          <SidebarGroupLabel>Governança de Dados</SidebarGroupLabel>
          <NavItem to="/" icon={DashboardSquare01Icon}>
            Dashboard
          </NavItem>
          <NavItem to="/catalogo" icon={BookOpen01Icon}>
            Catálogo
          </NavItem>
          <NavItem to="/scanner" icon={ScanIcon}>
            Scanner
          </NavItem>
          <NavItem to="/dominios" icon={Layers01Icon}>
            Domínios
          </NavItem>
          <NavItem to="/nomenclatura" icon={SpellCheckIcon}>
            Nomenclatura
          </NavItem>
        </SidebarGroup>
      </SidebarContent>
    </>
  )

  if (isMobile) {
    return (
      <>
        <div className="flex shrink-0 items-center justify-between border-b bg-[#f9fafb] p-3">
          <Logo size="md" variant="icon-nobg" />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Abrir menu de navegação"
            onClick={() => setMobileOpen(true)}
          >
            <HugeiconsIcon icon={Menu01Icon} />
          </Button>
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="flex flex-col p-0">
            <SheetHeader>
              <SheetTitle>Menu de navegação</SheetTitle>
              <SheetClose asChild>
                <Button variant="ghost" size="icon" aria-label="Fechar menu">
                  <HugeiconsIcon icon={Cancel01Icon} />
                </Button>
              </SheetClose>
            </SheetHeader>
            <SidebarRoot
              className="h-full overflow-visible bg-[#f9fafb]"
              width="100%"
              value={pathname}
              onValueChange={handleNavigate}
            >
              {navMenuContent}
            </SidebarRoot>
          </SheetContent>
        </Sheet>
      </>
    )
  }

  return (
    <SidebarRoot
      className="h-screen shrink-0 overflow-visible bg-[#f9fafb]"
      width="16rem"
      value={pathname}
      onValueChange={handleNavigate}
    >
      {navMenuContent}
    </SidebarRoot>
  )
})

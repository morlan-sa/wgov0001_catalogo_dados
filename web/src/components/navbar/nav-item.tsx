import { HugeiconsIcon, IconSvgElement } from "@hugeicons/react"
import { SidebarItem } from "@morlan/ui"
import { memo, ReactNode } from "react"

interface NavItemProps {
  to: string
  children: ReactNode
  icon?: IconSvgElement
}

export const NavItem = memo(function NavItem({
  to,
  icon,
  children,
}: NavItemProps) {
  return (
    <SidebarItem value={to}>
      {icon && <HugeiconsIcon icon={icon} size={16} strokeWidth={1.5} />}
      {children}
    </SidebarItem>
  )
})

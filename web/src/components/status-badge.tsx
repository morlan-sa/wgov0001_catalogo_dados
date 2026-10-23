import { Badge, type BadgeProps } from "@morlan/ui"
import { statusVariant } from "@/utils/status"

export function StatusBadge({
  children,
  ...props
}: Omit<BadgeProps, "variant" | "children"> & { children: string }) {
  return (
    <Badge variant={statusVariant(children)} {...props}>
      {children}
    </Badge>
  )
}

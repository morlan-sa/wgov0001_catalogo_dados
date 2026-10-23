import { Link } from "react-router-dom"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Card, P, Span } from "@morlan/ui"

interface StatCardProps {
  label: string
  value: number | string
  icon?: IconSvgElement
  to?: string
  subtitle?: string
}

export function StatCard({ label, value, icon, to, subtitle }: StatCardProps) {
  const content = (
    <Card
      className={`h-full min-w-[160px] flex-1 gap-1 p-4 ${
        to ? "transition-colors hover:border-primary" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <Span variant="muted">{label}</Span>
        {icon && (
          <HugeiconsIcon icon={icon} size={18} className="text-primary" />
        )}
      </div>
      <P className="text-2xl font-bold text-foreground">{value}</P>
      {subtitle && <Span variant="small">{subtitle}</Span>}
    </Card>
  )

  return to ? (
    <Link to={to} className="flex min-w-[160px] flex-1">
      {content}
    </Link>
  ) : (
    <div className="flex min-w-[160px] flex-1">{content}</div>
  )
}

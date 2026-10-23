import { useState } from "react"
import { useSessao } from "@/hooks/use-sessao"
import { getInitials } from "@/utils/format"
import { ArrowDown01Icon, LogoutSquare01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Span,
  Avatar,
  AvatarFallback,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Button,
  P,
  Separator,
  toast,
} from "@morlan/ui"

export function UserPopover() {
  const { user, logout } = useSessao()
  const [saindo, setSaindo] = useState(false)
  const displayName = user?.nome ?? user?.usuario ?? ""
  const initials = user ? getInitials(user.nome ?? user.usuario) : "U"

  async function handleLogout() {
    setSaindo(true)
    try {
      await logout()
    } catch {
      toast.error("Não foi possível encerrar sua sessão. Tente novamente.")
      setSaindo(false)
    }
  }

  return (
    <Popover>
      <PopoverTrigger className="flex cursor-pointer items-center gap-2 p-1 hover:bg-muted">
        <Avatar className="h-8 w-8 bg-accent">
          <AvatarFallback className="font-bold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <Span className="text-sm font-medium">{displayName}</Span>

        <HugeiconsIcon icon={ArrowDown01Icon} size={16} strokeWidth={1.6} />
      </PopoverTrigger>

      <PopoverContent align="end" className="min-w-64">
        <div className="flex flex-col justify-start">
          <div className="space-y-2 p-4">
            <div>
              <P className="font-semibold text-foreground">{displayName}</P>
              <P>{user?.email}</P>
            </div>
          </div>

          <Separator />

          <Button
            variant="ghost"
            onClick={() => void handleLogout()}
            disabled={saindo}
            className="m-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <HugeiconsIcon icon={LogoutSquare01Icon} />
            Sair
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

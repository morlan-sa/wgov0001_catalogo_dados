import { HugeiconsIcon } from "@hugeicons/react"
import { cn, ToggleGroup, ToggleGroupItem, useTheme } from "@morlan/ui"
import { Moon02Icon, Sun02Icon } from "@hugeicons/core-free-icons"

interface ThemeTogglerProps {
  collapsed?: boolean
}

export function ThemeToggler({ collapsed }: ThemeTogglerProps) {
  const { theme, setTheme } = useTheme()

  return (
    <ToggleGroup
      size="sm"
      type="single"
      value={theme}
      onValueChange={setTheme}
      className={cn("bg-muted", collapsed && "flex-col")}
    >
      <ToggleGroupItem value="dark" className="m-1">
        <HugeiconsIcon icon={Moon02Icon} />
      </ToggleGroupItem>
      <ToggleGroupItem value="light" className="m-1">
        <HugeiconsIcon icon={Sun02Icon} />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

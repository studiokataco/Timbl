"use client"

import { Ellipsis, Menu, PanelRight, Plus, Search, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatDay } from "../clock"
import { TOUCH, tw } from "../lib"
import { usePrototype } from "../prototype-context"

export type InterfaceTopBarProps = {
  weekStart: string
  density: "touch" | "pointer"
  onOpenTimbl: () => void
  onOverview?: () => void
  overviewOpen?: boolean
  onMenu?: () => void
  onCreate?: () => void
  onSearch?: () => void
  notifications?: React.ReactNode
  presence: React.ReactNode
}

export function InterfaceTopBar({
  weekStart,
  density,
  onOpenTimbl,
  onOverview,
  overviewOpen = false,
  onMenu,
  onCreate,
  onSearch,
  notifications,
  presence,
}: InterfaceTopBarProps): React.JSX.Element {
  const { copy } = usePrototype()
  const t = copy.iface.topbar

  return (
    <header
      data-slot="agentic-interface-top-bar"
      className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-3"
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {onMenu ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t.menu}
            onClick={onMenu}
            className={tw("shrink-0 @3xl/iface:hidden", density === "touch" && TOUCH.icon)}
          >
            <Menu className="size-4" aria-hidden />
          </Button>
        ) : null}
        <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
          <ol className="flex min-w-0 items-center gap-1.5">
            <li className="shrink-0">
              <h1 className="inline">
                <span className="text-title-sm text-muted-foreground">{t.crumb}</span>
              </h1>
            </li>
            <li aria-hidden="true" className="shrink-0 text-caption text-muted-foreground">
              /
            </li>
            <li aria-current="page" className="min-w-0 truncate text-body-sm font-medium text-foreground">
              {t.crumbSub(formatDay(weekStart))}
            </li>
          </ol>
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <div className="hidden @md/iface:block">{presence}</div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t.search}
          onClick={onSearch}
          className="hidden @3xl/iface:inline-flex"
        >
          <Search className="size-4" aria-hidden />
        </Button>
        <div className="hidden @3xl/iface:block">{notifications}</div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenTimbl}
          className={tw("hidden @md/iface:inline-flex", density === "touch" && TOUCH.control)}
        >
          <Sparkles className="size-4" aria-hidden />
          <span>{t.open}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={t.open}
          onClick={onOpenTimbl}
          className="@md/iface:hidden"
        >
          <Sparkles className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onCreate}
          className="hidden @3xl/iface:inline-flex"
        >
          <Plus className="size-4" aria-hidden />
          <span>{t.create}</span>
        </Button>
        {onOverview ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t.overview}
            onClick={onOverview}
            className={tw(
              "hidden @3xl/iface:inline-flex",
              overviewOpen && "@7xl/iface:hidden",
            )}
          >
            <PanelRight className="size-4" aria-hidden />
          </Button>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t.moreActions}
                className={tw("@3xl/iface:hidden", density === "touch" && TOUCH.icon)}
              />
            }
          >
            <Ellipsis className="size-4" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onSearch}>{t.search}</DropdownMenuItem>
            <DropdownMenuItem onClick={onCreate}>{t.create}</DropdownMenuItem>
            {onOverview && !overviewOpen ? <DropdownMenuItem onClick={onOverview}>{t.overview}</DropdownMenuItem> : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

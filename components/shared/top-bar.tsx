"use client"

import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { useDialogs } from "@/components/shared/dialogs-provider"
import { DEV_SESSION } from "@/lib/auth/dev-session"

export function TopBar() {
  const { openQuickAdd } = useDialogs()
  const initials = DEV_SESSION.user.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <header className="border-b border-border bg-background sticky top-0 z-30">
      <div className="flex items-center gap-4 px-6 sm:px-10 h-16">
        <a
          href="/calendar"
          className="flex items-baseline gap-2 group"
          aria-label="Social planner home"
        >
          <span className="text-base font-semibold tracking-tight leading-none text-foreground">
            social planner
          </span>
          <span
            aria-hidden
            className="size-1 rounded-full bg-foreground translate-y-[-3px] group-hover:bg-[var(--color-brand-accent)] transition-colors"
          />
          <span className="text-caption text-muted-foreground leading-none tracking-tight">
            SAFE
          </span>
        </a>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("palette:open"))}
          className="hidden md:flex items-center gap-2 text-body-sm text-muted-foreground border border-border rounded-md px-3 h-9 w-64 hover:text-foreground hover:bg-secondary/40 transition-colors"
          aria-label="Open command palette"
        >
          <Search aria-hidden className="size-4 opacity-60" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="font-mono text-[11px] tracking-widest opacity-60 border border-border rounded px-1 py-0.5">
            ⌘K
          </kbd>
        </button>

        <ThemeToggle />

        <Button
          onClick={() => openQuickAdd({ source: "topbar" })}
          className="hidden sm:inline-flex"
        >
          <Plus aria-hidden className="size-4" />
          Quick add
        </Button>
        <Button
          onClick={() => openQuickAdd({ source: "topbar" })}
          size="icon"
          className="rounded-full sm:hidden"
          aria-label="Quick add"
        >
          <Plus aria-hidden className="size-4" />
        </Button>

        <Avatar className="size-9">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}

"use client"

import { Plus, Search, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { useDialogs } from "@/components/shared/dialogs-provider"

export function TopBar({ userName }: { userName: string }) {
  const { openQuickAdd } = useDialogs()
  const initials = userName
    .split(/[\s_-]+/)
    .map((p) => p[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?"

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
          className="hidden md:inline-flex items-center justify-center size-9 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
          aria-label="Search (⌘K)"
          title="Search · ⌘K"
        >
          <Search aria-hidden className="size-4" />
        </button>

        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("agent-drawer:open"))}
          className="hidden md:inline-flex items-center justify-center size-9 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
          aria-label="Open agent drawer (⌘J)"
          title="Agent · ⌘J"
        >
          <Sparkles aria-hidden className="size-4" />
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

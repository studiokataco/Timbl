"use client"

import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DEV_SESSION } from "@/lib/auth/dev-session"

/*
 * Top bar for the (app) tree. Logo + view title left, primary "Quick add"
 * CTA centre-right, ⌘K hint, avatar right.
 *
 * onQuickAdd is wired from a parent so the calendar page can hand over the
 * dialog opener without prop-drilling through context.
 */
export function TopBar({ onQuickAdd }: { onQuickAdd?: () => void }) {
  const initials = DEV_SESSION.user.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <header className="border-b border-border bg-background sticky top-0 z-30">
      <div className="flex items-center gap-4 px-4 sm:px-6 h-14">
        <a
          href="/calendar"
          className="flex items-baseline gap-1.5 group"
          aria-label="Social planner home"
        >
          <span className="text-base font-semibold tracking-tight leading-none">
            Social planner
          </span>
          <span
            aria-hidden
            className="size-1.5 rounded-full bg-[var(--color-signature-coral)] translate-y-[-2px] group-hover:scale-125 transition-transform"
          />
          <span className="text-xs font-medium text-muted-foreground leading-none">
            SAFE
          </span>
        </a>

        <div className="flex-1" />

        <Button
          onClick={onQuickAdd}
          className="rounded-full px-4 hidden sm:inline-flex"
        >
          <Plus aria-hidden className="size-4" />
          Quick add
        </Button>
        <Button
          onClick={onQuickAdd}
          size="icon"
          className="rounded-full sm:hidden"
          aria-label="Quick add"
        >
          <Plus aria-hidden className="size-4" />
        </Button>

        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("palette:open"))}
          className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-md px-2 py-1 hover:text-foreground hover:bg-secondary/40 transition-colors"
          aria-label="Open command palette"
        >
          <Search aria-hidden className="size-3" />
          <span>Search</span>
          <kbd className="font-mono text-[10px] tracking-widest opacity-70">
            ⌘K
          </kbd>
        </button>

        <Avatar className="size-8">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}

"use client"

import { LogOut, Monitor, Moon, Plus, Search, Sparkles, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "@/components/shared/theme-provider"
import { MobileNav } from "@/components/shared/mobile-nav"
import type { WorkspaceSwitcherData } from "@/lib/queries/workspaces.server"
import { NotificationsMenu } from "@/components/shared/notifications-menu"
import { RealtimeDegradedBadge } from "@/components/shared/realtime-degraded-badge"
import { useDialogs } from "@/components/shared/dialogs-provider"

export function TopBar({
  userName,
  workspaceName,
  workspaces,
}: {
  userName: string
  workspaceName: string
  workspaces: WorkspaceSwitcherData
}) {
  const { openQuickAdd } = useDialogs()
  const { theme, setTheme } = useTheme()
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
        <MobileNav workspaces={workspaces} />
        <h1 className="text-base font-semibold tracking-tight leading-none text-foreground truncate min-w-0">
          {workspaceName}
        </h1>

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
          aria-label="Agent sidebar · ⌘⇧J"
          title="Agent sidebar · ⌘⇧J"
        >
          <Sparkles aria-hidden className="size-4" />
        </button>

        <NotificationsMenu />

        <RealtimeDegradedBadge />

        <Button
          onClick={() => openQuickAdd({ source: "topbar" })}
          className="hidden sm:inline-flex"
        >
          <Plus aria-hidden className="size-4" />
          Create
        </Button>
        <Button
          onClick={() => openQuickAdd({ source: "topbar" })}
          size="icon"
          className="rounded-full sm:hidden"
          aria-label="Create"
        >
          <Plus aria-hidden className="size-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            type="button"
            aria-label="Account menu"
            className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:after:mix-blend-lighten"
          >
            {initials}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {userName}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Theme
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={theme}
              onValueChange={(value) => setTheme(value as typeof theme)}
            >
              <DropdownMenuRadioItem value="system">
                <Monitor aria-hidden />
                System
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="light">
                <Sun aria-hidden />
                Light
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <Moon aria-hidden />
                Dark
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              render={<a href="/auth/logout" />}
            >
              <LogOut aria-hidden />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

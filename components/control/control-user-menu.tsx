"use client"

import { ExternalLink, LogOut, ShieldCheck } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ControlNotifications } from "@/components/control/control-notifications"
import { ThemeToggle } from "@/components/shared/theme-toggle"

/*
 * Control-centre account menu: avatar (initials) + dropdown with the signed-in
 * platform admin, a link to the tenant app, theme toggle, and sign out.
 * Sign out hits the shared /auth/logout route (reachable on the admin host via
 * the proxy passthrough), which clears the session cookie and bounces to
 * sign-in.
 */
export function ControlUserMenu({ email }: { email: string }) {
  const initials =
    email
      .split(/[@.\s_-]+/)
      .map((p) => p[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"

  /* Tenant app host = admin host minus the "admin." prefix. */
  const adminHost = process.env.NEXT_PUBLIC_ADMIN_HOST
  const appHref = adminHost
    ? `${typeof window !== "undefined" ? window.location.protocol : "https:"}//${adminHost.replace(/^admin\./, "")}`
    : "/"

  return (
    <div className="flex items-center gap-2">
      <ControlNotifications />
      <ThemeToggle />
      <DropdownMenu>
        <DropdownMenuTrigger
          type="button"
          aria-label="Account menu"
          className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {initials}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuLabel className="flex items-center gap-2 text-xs">
            <ShieldCheck className="size-3.5" />
            <span className="truncate">{email}</span>
          </DropdownMenuLabel>
          <DropdownMenuLabel className="pt-0 text-[11px] font-normal text-muted-foreground">
            Platform admin
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<a href={appHref} target="_blank" rel="noreferrer" />}>
            <ExternalLink aria-hidden />
            Open tenant app
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" render={<a href="/auth/logout" />}>
            <LogOut aria-hidden />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

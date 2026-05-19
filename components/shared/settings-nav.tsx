"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

/*
 * Sub-navigation rendered inside /settings/* by `app/(app)/settings/layout.tsx`.
 * Designed as a horizontal pill rail under TopBar so it shares the page's
 * visual hierarchy with the main left sidebar without competing for the
 * same real estate. Mobile-aware: collapses to a horizontally scrollable
 * row at narrow widths.
 */

const NAV: { href: string; label: string }[] = [
  { href: "/settings/campaigns", label: "Campaigns" },
  { href: "/settings/categories", label: "Categories" },
  { href: "/settings/brand", label: "Brand" },
  { href: "/settings/workspace", label: "Workspace" },
]

export function SettingsNav() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Settings"
      className="border-b border-border bg-background"
    >
      <ul className="flex items-end gap-1 px-4 sm:px-6 overflow-x-auto no-scrollbar">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex items-center h-10 px-3 text-sm transition-colors",
                  active
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span>{item.label}</span>
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-2 right-2 -bottom-px h-0.5 rounded-full transition-colors",
                    active ? "bg-foreground" : "bg-transparent",
                  )}
                />
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

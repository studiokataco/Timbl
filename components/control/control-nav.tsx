"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

/*
 * Control-centre top nav. Links use clean paths (/dashboard, /tenants, ...)
 * because the admin-host proxy rewrites them into the (control) group - the
 * browser URL never shows /control. Active state matches on suffix so it
 * works whether usePathname returns the browser path or the rewritten one.
 */

const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/ai-usage", label: "AI usage" },
  { href: "/tenants", label: "Tenants" },
  { href: "/signups", label: "Signups" },
  { href: "/live-ops", label: "Live ops" },
  { href: "/revenue", label: "Revenue" },
  { href: "/assistant", label: "Assistant" },
  { href: "/audit", label: "Audit" },
  { href: "/team", label: "Team" },
]

export function ControlNav({ pendingSignups = 0 }: { pendingSignups?: number }) {
  const pathname = usePathname() ?? ""
  return (
    <nav className="flex items-center gap-1">
      {LINKS.map((link) => {
        const active =
          pathname === link.href ||
          pathname.endsWith(link.href) ||
          (link.href === "/dashboard" && pathname.endsWith("/control"))
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {link.label}
            {link.href === "/signups" && pendingSignups > 0 ? (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold text-white">
                {pendingSignups > 99 ? "99+" : pendingSignups}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}

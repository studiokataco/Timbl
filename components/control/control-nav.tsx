"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, ShieldCheck, X } from "lucide-react"

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/ai-usage", label: "AI usage" },
  { href: "/tenants", label: "Tenants" },
  { href: "/retention", label: "Retention" },
  { href: "/signups", label: "Signups" },
  { href: "/live-ops", label: "Live ops" },
  { href: "/revenue", label: "Revenue" },
  { href: "/assistant", label: "Assistant" },
  { href: "/audit", label: "Audit" },
  { href: "/team", label: "Team" },
]

function NavLink({
  href,
  label,
  active,
  pendingSignups,
  onClick,
  mobile,
}: {
  href: string
  label: string
  active: boolean
  pendingSignups?: number
  onClick?: () => void
  mobile?: boolean
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "relative inline-flex items-center gap-1.5 rounded-md font-medium transition-colors",
        mobile
          ? "w-full px-3 py-2.5 text-base"
          : "px-3 py-1.5 text-sm",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
      {href === "/signups" && pendingSignups && pendingSignups > 0 ? (
        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold text-white">
          {pendingSignups > 99 ? "99+" : pendingSignups}
        </span>
      ) : null}
    </Link>
  )
}

export function ControlNav({ pendingSignups = 0 }: { pendingSignups?: number }) {
  const pathname = usePathname() ?? ""
  const [open, setOpen] = useState(false)

  function isActive(href: string) {
    return (
      pathname === href ||
      pathname.endsWith(href) ||
      (href === "/dashboard" && pathname.endsWith("/control"))
    )
  }

  return (
    <>
      <nav className="hidden items-center gap-1 md:flex">
        {LINKS.map((link) => (
          <NavLink
            key={link.href}
            href={link.href}
            label={link.label}
            active={isActive(link.href)}
            pendingSignups={pendingSignups}
          />
        ))}
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          aria-label="Open navigation"
          className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </SheetTrigger>
        <SheetContent side="left" className="w-72 max-w-[80vw] p-0">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <ShieldCheck className="size-5" />
            <span className="font-heading text-sm font-semibold tracking-tight">
              Control centre
            </span>
          </div>
          <nav className="flex flex-col gap-1 p-3">
            {LINKS.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                active={isActive(link.href)}
                pendingSignups={pendingSignups}
                onClick={() => setOpen(false)}
                mobile
              />
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  )
}

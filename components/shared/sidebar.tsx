"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Calendar,
  KanbanSquare,
  LayoutList,
  Megaphone,
  BookOpen,
  Globe,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"

/*
 * Persistent left-rail navigation for the (app) tree. Cal-voiced — generous
 * breathing room, soft pill rounding, an inset section heading separating
 * the working surfaces (Calendar/Posts/Kanban/Campaigns) from the
 * reference resources (Library/Awareness).
 */
type NavGroup = {
  heading?: string
  items: { href: string; label: string; icon: typeof Calendar }[]
}

const GROUPS: NavGroup[] = [
  {
    items: [
      { href: "/calendar", label: "Calendar", icon: Calendar },
      { href: "/posts", label: "All posts", icon: LayoutList },
      { href: "/kanban", label: "Kanban", icon: KanbanSquare },
      { href: "/campaigns", label: "Campaigns", icon: Megaphone },
      { href: "/studio", label: "Studio", icon: Sparkles },
    ],
  },
  {
    heading: "Resources",
    items: [
      { href: "/library", label: "Library", icon: BookOpen },
      { href: "/awareness", label: "Awareness days", icon: Globe },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Primary"
      className="hidden md:flex flex-col w-60 shrink-0 border-r border-border bg-background px-3 py-6 gap-1 overflow-y-auto"
    >
      {GROUPS.map((group, gi) => (
        <div
          key={gi}
          className={cn("flex flex-col gap-1", gi > 0 && "mt-6")}
        >
          {group.heading && (
            <p className="text-caption text-muted-foreground px-3 pb-1.5 uppercase tracking-wider">
              {group.heading}
            </p>
          )}
          {group.items.map((item) => {
            const Icon = item.icon
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-2.5 bottom-2.5 w-0.5 rounded-full bg-foreground"
                  />
                )}
                <Icon aria-hidden className="size-4" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

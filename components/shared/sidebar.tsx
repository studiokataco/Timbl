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
} from "lucide-react"
import { cn } from "@/lib/utils"

/*
 * Persistent left-rail navigation for the (app) tree. Routes ahead of their
 * Phase 4–5 implementations are still wired so the IA reads consistently and
 * 404s are friendlier than dead links.
 */
const ITEMS = [
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/posts", label: "All posts", icon: LayoutList },
  { href: "/kanban", label: "Kanban", icon: KanbanSquare },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/library", label: "Library", icon: BookOpen },
  { href: "/awareness", label: "Awareness days", icon: Globe },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Primary"
      className="hidden md:flex flex-col w-56 shrink-0 border-r border-border bg-background px-3 py-4 gap-0.5"
    >
      {ITEMS.map((item) => {
        const Icon = item.icon
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )}
          >
            <Icon aria-hidden className="size-4" />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

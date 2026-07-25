"use client"

import { useState } from "react"
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
  Settings,
  MessageSquareText,
} from "lucide-react"
import { TimblWordmark } from "@/components/brand/timbl-logo"
import { WorkspaceSwitcher } from "@/components/shared/workspace-switcher"
import { BrandSwitcher } from "@/components/shared/brand-switcher"
import { FeedbackDialog } from "@/components/shared/feedback-dialog"
import type { WorkspaceSwitcherData } from "@/lib/queries/workspaces.server"
import type { BrandSwitcherData } from "@/lib/queries/brands.server"
import { cn } from "@/lib/utils"

/*
 * Persistent left-rail navigation for the (app) tree. Cal-voiced - generous
 * breathing room, soft pill rounding, an inset section heading separating
 * the working surfaces (Calendar/Posts/Kanban/Campaigns) from the
 * reference resources (Templates/Awareness).
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
      { href: "/studio", label: "AI Studio", icon: Sparkles },
    ],
  },
  {
    heading: "Resources",
    items: [
      { href: "/templates", label: "Templates", icon: BookOpen },
      { href: "/awareness", label: "Awareness days", icon: Globe },
    ],
  },
  {
    heading: "Workspace",
    items: [
      // /settings is the Settings overview; its sub-nav (Overview/
      // Workspace/Brand/Categories) takes over from there. The Workspace
      // tab is where the setup wizard is re-run.
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
]

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <>
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
                onClick={onNavigate}
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
    </>
  )
}

export function FeedbackTrigger({
  onNavigate,
  className,
}: {
  onNavigate?: () => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          onNavigate?.()
        }}
        className={cn(
          "timbl-feedback-trigger flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground",
          className,
        )}
      >
        <MessageSquareText aria-hidden className="size-4" />
        <span>Send feedback</span>
      </button>
      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

export function Sidebar({
  workspaces,
  brands,
}: {
  workspaces: WorkspaceSwitcherData
  brands: BrandSwitcherData
}) {
  return (
    <nav
      aria-label="Primary"
      className="hidden md:flex flex-col w-60 shrink-0 border-r border-border bg-background px-3 py-6 gap-1 overflow-y-auto"
    >
      <TimblWordmark href="/calendar" logoSize={24} className="px-3 mb-4" />
      <WorkspaceSwitcher data={workspaces} className="mb-2" />
      <BrandSwitcher data={brands} className="mb-4" />
      <SidebarNav />
      <FeedbackTrigger className="mt-auto" />
    </nav>
  )
}

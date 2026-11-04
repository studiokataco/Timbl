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
import { IdentityAvatar } from "@/components/shared/identity-avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { WorkspaceSwitcherData } from "@/lib/queries/workspaces.server"
import type { BrandSwitcherData } from "@/lib/queries/brands.server"
import { cn } from "@/lib/utils"

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
            <p className="text-caption text-muted-foreground px-3 pb-1.5 hidden @7xl/iface:block">
              {group.heading}
            </p>
          )}
          {group.items.map((item) => {
            const Icon = item.icon
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`)
            const link = (
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-label={item.label}
                className={cn(
                  "relative flex items-center justify-center @7xl/iface:justify-start gap-2.5 rounded-lg px-0 @7xl/iface:px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-2.5 bottom-2.5 w-0.5 rounded-full bg-foreground hidden @7xl/iface:block"
                  />
                )}
                <Icon aria-hidden className="size-4" />
                <span className="hidden @7xl/iface:inline">{item.label}</span>
              </Link>
            )
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger render={<div className="@7xl/iface:contents" />}>
                  {link}
                </TooltipTrigger>
                <TooltipContent side="right" className="@7xl/iface:hidden">
                  {item.label}
                </TooltipContent>
              </Tooltip>
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
        aria-label="Send feedback"
        className={cn(
          "timbl-feedback-trigger flex items-center justify-center @7xl/iface:justify-start gap-2.5 rounded-lg px-0 @7xl/iface:px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground",
          className,
        )}
      >
        <MessageSquareText aria-hidden className="size-4" />
        <span className="hidden @7xl/iface:inline">Send feedback</span>
      </button>
      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

export function WorkspaceBrandCard({
  workspaces,
  brands,
  className,
}: {
  workspaces: WorkspaceSwitcherData
  brands: BrandSwitcherData
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-background",
        className,
      )}
    >
      <WorkspaceSwitcher data={workspaces} nested />
      <div className="mx-2.5 border-t border-border" />
      <BrandSwitcher data={brands} nested />
    </div>
  )
}

export function Sidebar({
  workspaces,
  brands,
  user,
}: {
  workspaces: WorkspaceSwitcherData
  brands: BrandSwitcherData
  user: { name: string; email: string; role: string; avatarUrl?: string }
}) {
  return (
    <TooltipProvider>
      <nav
        aria-label="Primary"
        className="hidden @3xl/iface:flex flex-col w-16 @7xl/iface:w-60 shrink-0 border-r border-border bg-background px-2 @7xl/iface:px-3 py-6 gap-1 overflow-y-auto"
      >
        <TimblWordmark
          href="/calendar"
          logoSize={24}
          className="mb-4 justify-center @7xl/iface:justify-start px-0 @7xl/iface:px-3 [&_span]:hidden @7xl/iface:[&_span]:inline"
        />
        <WorkspaceBrandCard
          workspaces={workspaces}
          brands={brands}
          className="mb-4 hidden @7xl/iface:block"
        />
        <SidebarNav />
        <FeedbackTrigger className="mt-auto" />
        <div className="mt-2 flex items-center justify-center @7xl/iface:justify-start gap-2.5 rounded-lg px-0 @7xl/iface:px-2 py-2">
          <IdentityAvatar
            name={user.name}
            src={user.avatarUrl}
            shape="circle"
            className="size-8 shrink-0"
          />
          <div className="min-w-0 hidden @7xl/iface:block">
            <p className="truncate text-body-sm font-medium text-foreground">{user.name}</p>
            <p className="truncate text-caption capitalize text-muted-foreground">{user.role}</p>
          </div>
        </div>
      </nav>
    </TooltipProvider>
  )
}

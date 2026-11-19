"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Archive,
  BookOpen,
  Calendar,
  ChevronLeft,
  Globe,
  KanbanSquare,
  LayoutList,
  Megaphone,
  MessageSquare,
  MessageSquareText,
  PanelLeftClose,
  Plug,
  Search,
  Settings,
  Sparkles,
  SquarePen,
  Users,
} from "lucide-react"
import { TimblWordmark } from "@/components/brand/timbl-logo"
import { WorkspaceSwitcher } from "@/components/shared/workspace-switcher"
import { BrandSwitcher } from "@/components/shared/brand-switcher"
import { FeedbackDialog } from "@/components/shared/feedback-dialog"
import { IdentityAvatar } from "@/components/shared/identity-avatar"
import { SIDEBAR_COLLAPSED_KEY, useStoredFlag } from "@/components/shared/use-stored-flag"
import { useWorkspaceOrgId } from "@/components/shared/workspace-provider"
import { ChatMenu, groupThreads, rememberInterfaceRoute, useHomeChats, useStartOfToday } from "@/components/home/home-chats"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { WorkspaceSwitcherData } from "@/lib/queries/workspaces.server"
import type { BrandSwitcherData } from "@/lib/queries/brands.server"
import type { AssistantThreadListItem } from "@/lib/schemas/assistantThread"
import { DEFAULT_APP_ROUTE } from "@/lib/constants/timbl"
import { cn } from "@/lib/utils"

type Layout = { full: boolean }
type NavCopy = ReturnType<typeof useHomeChats>["copy"]

const ROW = "flex h-8 w-full items-center gap-2.5 rounded-lg text-sm transition-colors focus-ring"
const IDLE = "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
const ACTIVE = "bg-secondary font-medium text-foreground"

function interfaceGroups(copy: NavCopy): { heading?: string; items: { href: string; label: string; icon: typeof Calendar }[] }[] {
  return [
    {
      items: [
        { href: "/calendar", label: copy.nav.calendar, icon: Calendar },
        { href: "/posts", label: copy.nav.posts, icon: LayoutList },
        { href: "/kanban", label: copy.nav.kanban, icon: KanbanSquare },
        { href: "/campaigns", label: copy.nav.campaigns, icon: Megaphone },
        { href: "/studio", label: copy.nav.studio, icon: Sparkles },
      ],
    },
    {
      heading: copy.resources,
      items: [
        { href: "/templates", label: copy.nav.templates, icon: BookOpen },
        { href: "/awareness", label: copy.nav.awareness, icon: Globe },
      ],
    },
  ]
}

function rowLayout({ full }: Layout) {
  return full ? "h-11 justify-start px-2.5" : "justify-center px-0 @7xl/iface:justify-start @7xl/iface:px-2.5"
}

function labelClass({ full }: Layout) {
  return full ? "inline" : "hidden @7xl/iface:inline"
}

function WithTip({ layout, label, children }: { layout: Layout; label: string; children: React.ReactElement }) {
  if (layout.full) return children
  return (
    <Tooltip>
      <TooltipTrigger render={<div className="@7xl/iface:contents" />}>{children}</TooltipTrigger>
      <TooltipContent side="right" className="@7xl/iface:hidden">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function SearchField({ layout, label }: { layout: Layout; label: string }) {
  return (
    <WithTip layout={layout} label={label}>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("palette:open"))}
        aria-label={label}
        aria-keyshortcuts="Meta+K"
        className={cn(
          ROW,
          rowLayout(layout),
          "text-muted-foreground hover:text-foreground",
          layout.full ? "bg-secondary/60 hover:bg-secondary" : "hover:bg-secondary/60 @7xl/iface:bg-secondary/60 @7xl/iface:hover:bg-secondary",
        )}
      >
        <Search aria-hidden className="size-4 shrink-0" />
        <span className={cn("flex-1 text-left", labelClass(layout))}>{label}</span>
        <kbd className={cn("rounded border border-border px-1 font-mono text-caption leading-4 text-muted-foreground", labelClass(layout))}>⌘K</kbd>
      </button>
    </WithTip>
  )
}

function ActionRow({ layout, icon: Icon, label, onClick }: { layout: Layout; icon: typeof Search; label: string; onClick: () => void }) {
  return (
    <WithTip layout={layout} label={label}>
      <button type="button" onClick={onClick} aria-label={label} className={cn(ROW, rowLayout(layout), IDLE)}>
        <Icon aria-hidden className="size-4 shrink-0" />
        <span className={labelClass(layout)}>{label}</span>
      </button>
    </WithTip>
  )
}

function NavRow({
  layout,
  href,
  icon: Icon,
  label,
  onNavigate,
}: {
  layout: Layout
  href: string
  icon: typeof Search
  label: string
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(`${href}/`)
  return (
    <WithTip layout={layout} label={label}>
      <Link href={href} onClick={onNavigate} aria-label={label} aria-current={active ? "page" : undefined} className={cn(ROW, rowLayout(layout), active ? ACTIVE : IDLE)}>
        <Icon aria-hidden className="size-4 shrink-0" />
        <span className={labelClass(layout)}>{label}</span>
      </Link>
    </WithTip>
  )
}

function InterfaceNav({ layout, onNavigate }: { layout: Layout; onNavigate?: () => void }) {
  const { copy } = useHomeChats()
  return (
    <div className="flex flex-col">
      {interfaceGroups(copy).map((group, index) => (
        <section key={group.heading ?? index} aria-label={group.heading} className="flex flex-col gap-0.5">
          {group.heading ? (
            <>
              <p className={cn("px-2.5 pt-6 pb-2 text-caption text-muted-foreground", layout.full ? "block" : "hidden @7xl/iface:block")}>{group.heading}</p>
              {layout.full ? null : <span aria-hidden className="mx-2 my-3 block h-px bg-border @7xl/iface:hidden" />}
            </>
          ) : (
            <span aria-hidden className={cn("pt-2", layout.full ? "block" : "hidden @7xl/iface:block")} />
          )}
          {group.items.map((item) => (
            <NavRow key={item.href} layout={layout} href={item.href} icon={item.icon} label={item.label} onNavigate={onNavigate} />
          ))}
        </section>
      ))}
    </div>
  )
}

function ChatRow({ thread, full, onNavigate }: { thread: AssistantThreadListItem; full: boolean; onNavigate?: () => void }) {
  const { chatId, onHome, openChat, copy } = useHomeChats()
  const active = onHome && thread.id === chatId
  const Icon = thread.visibility === "workspace" ? Users : MessageSquare
  const status = thread.needsYou ? copy.needsYou : thread.unread ? copy.newReply : null
  return (
    <div className="group/chat relative">
      <button
        type="button"
        onClick={() => {
          openChat(thread.id)
          onNavigate?.()
        }}
        aria-current={active ? "page" : undefined}
        aria-label={[thread.title, thread.visibility === "workspace" ? copy.sharedLabel : null, status].filter(Boolean).join(", ")}
        className={cn(ROW, "px-2.5 text-left group-focus-within/chat:pr-9 group-hover/chat:pr-9", full && "h-11", active ? ACTIVE : IDLE)}
      >
        <Icon aria-hidden className="size-4 shrink-0 opacity-70" />
        <span className="min-w-0 flex-1 truncate">{thread.title}</span>
        {thread.needsYou ? (
          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-badge-orange group-focus-within/chat:hidden group-hover/chat:hidden" />
        ) : thread.unread ? (
          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-brand-accent group-focus-within/chat:hidden group-hover/chat:hidden" />
        ) : null}
      </button>
      <ChatMenu
        thread={thread}
        align="start"
        triggerClassName="absolute top-1/2 right-1 size-6 -translate-y-1/2 opacity-0 group-hover/chat:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
      />
    </div>
  )
}

function GroupLabel({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return <p className={cn("px-2.5 pb-2 text-caption text-muted-foreground", first ? "pt-2" : "pt-6")}>{children}</p>
}

function ChatList({ full, onNavigate }: { full: boolean; onNavigate?: () => void }) {
  const { threads, copy } = useHomeChats()
  const [archivedOpen, setArchivedOpen] = useState(false)
  const startOfToday = useStartOfToday()
  const groups = groupThreads(threads, startOfToday)
  const archived = threads.filter((thread) => thread.archived)

  if (archivedOpen) {
    return (
      <div className="flex flex-col gap-0.5">
        <button type="button" onClick={() => setArchivedOpen(false)} className={cn(ROW, "px-2.5 text-caption", full && "h-11", IDLE)}>
          <ChevronLeft className="size-4 shrink-0" aria-hidden />
          {copy.backToChats}
        </button>
        <GroupLabel>{copy.archived}</GroupLabel>
        {archived.length ? (
          archived.map((thread) => <ChatRow key={thread.id} thread={thread} full={full} onNavigate={onNavigate} />)
        ) : (
          <p className="px-2.5 py-2 text-caption text-muted-foreground">{copy.emptyArchived}</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {groups.length === 0 ? <p className="px-2.5 pt-2 text-caption text-muted-foreground">{copy.empty}</p> : null}
      {groups.map((group, index) => (
        <section key={group.key} aria-label={copy.sections[group.key]} className="flex flex-col gap-0.5">
          <GroupLabel first={index === 0}>{copy.sections[group.key]}</GroupLabel>
          {group.rows.map((thread) => (
            <ChatRow key={thread.id} thread={thread} full={full} onNavigate={onNavigate} />
          ))}
        </section>
      ))}
      {archived.length ? (
        <button type="button" onClick={() => setArchivedOpen(true)} className={cn(ROW, "mt-6 px-2.5", full && "h-11", IDLE)}>
          <Archive className="size-4 shrink-0" aria-hidden />
          <span className="flex-1 text-left">{copy.archived}</span>
          <span className="font-mono text-caption tabular-nums">{archived.length}</span>
        </button>
      ) : null}
    </div>
  )
}

export function FeedbackTrigger({
  onNavigate,
  className,
  mobile = false,
}: {
  onNavigate?: () => void
  className?: string
  mobile?: boolean
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
          "timbl-feedback-trigger flex min-h-8 items-center gap-2.5 rounded-lg text-sm text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground focus-ring",
          mobile ? "min-h-11 w-full justify-start px-2.5" : "justify-center px-0 @7xl/iface:justify-start @7xl/iface:px-2.5",
          className,
        )}
      >
        <MessageSquareText aria-hidden className="size-4 shrink-0" />
        <span className={mobile ? "inline" : "hidden @7xl/iface:inline"}>Send feedback</span>
      </button>
      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

export function WorkspaceBrandCard({
  workspaces,
  brands,
  className,
  onNavigate,
}: {
  workspaces: WorkspaceSwitcherData
  brands: BrandSwitcherData
  className?: string
  onNavigate?: () => void
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-background", className)}>
      <WorkspaceSwitcher data={workspaces} nested onNavigate={onNavigate} />
      <div className="mx-2.5 border-t border-border" />
      <BrandSwitcher data={brands} nested onNavigate={onNavigate} />
    </div>
  )
}

type SidebarData = {
  workspaces: WorkspaceSwitcherData
  brands: BrandSwitcherData
  user: { name: string; email: string; role: string; avatarUrl?: string }
}

export function SidebarContent({
  workspaces,
  brands,
  user,
  full = false,
  onCollapse,
  onNavigate,
}: SidebarData & { full?: boolean; onCollapse?: () => void; onNavigate?: () => void }) {
  const { copy, newChat, onHome } = useHomeChats()
  const layout: Layout = { full }

  return (
    <>
      <div className={cn("flex h-14 shrink-0 items-center", full ? "justify-between pl-2.5" : "justify-center @7xl/iface:justify-between @7xl/iface:pl-2.5")}>
        <TimblWordmark
          href={DEFAULT_APP_ROUTE}
          logoSize={22}
          onClick={onNavigate}
          className={cn(full ? "" : "justify-center @7xl/iface:justify-start [&_span]:hidden @7xl/iface:[&_span]:inline")}
        />
        {onCollapse ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`${copy.closeSidebar} (⌘\\)`}
            aria-keyshortcuts="Meta+Backslash"
            onClick={onCollapse}
            className={cn("text-muted-foreground", full ? "inline-flex" : "hidden @7xl/iface:inline-flex")}
          >
            <PanelLeftClose className="size-4" aria-hidden />
          </Button>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col gap-0.5">
        <WorkspaceBrandCard workspaces={workspaces} brands={brands} onNavigate={onNavigate} className={cn("mb-3", full ? "block" : "hidden @7xl/iface:block")} />
        <SearchField layout={layout} label={copy.searchOrAsk} />
        <ActionRow
          layout={layout}
          icon={SquarePen}
          label={copy.newChat}
          onClick={() => {
            newChat()
            onNavigate?.()
          }}
        />
      </div>

      {onHome ? (
        <>
          <div className={cn("-mx-2 mt-2 min-h-0 flex-1 overflow-y-auto px-2 pb-4", full ? "block" : "hidden @7xl/iface:block")}>
            <ChatList full={full} onNavigate={onNavigate} />
          </div>
          <div className={cn("flex-1", full ? "hidden" : "@7xl/iface:hidden")} />
        </>
      ) : (
        <div className="-mx-2 mt-2 min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          <InterfaceNav layout={layout} onNavigate={onNavigate} />
        </div>
      )}

      <div className="flex shrink-0 flex-col gap-0.5 border-t border-border pt-3">
        <NavRow layout={layout} href="/settings/integrations" icon={Plug} label={copy.connections} onNavigate={onNavigate} />
        <NavRow layout={layout} href="/settings" icon={Settings} label={copy.settings} onNavigate={onNavigate} />
        <FeedbackTrigger mobile={full} onNavigate={onNavigate} />
        <div className={cn("mt-2 flex items-center gap-2.5 py-1", full ? "px-1.5" : "justify-center @7xl/iface:justify-start @7xl/iface:px-1.5")}>
          <IdentityAvatar name={user.name} src={user.avatarUrl} shape="circle" className="size-7 shrink-0" />
          <div className={cn("min-w-0", full ? "block" : "hidden @7xl/iface:block")}>
            <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
            <p className="truncate text-caption text-muted-foreground capitalize">{user.role}</p>
          </div>
        </div>
      </div>
    </>
  )
}

export function Sidebar(props: SidebarData) {
  const { onHome } = useHomeChats()
  const orgId = useWorkspaceOrgId()
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useStoredFlag(SIDEBAR_COLLAPSED_KEY)

  useEffect(() => {
    if (!onHome) rememberInterfaceRoute(orgId, pathname)
  }, [onHome, orgId, pathname])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "\\") {
        event.preventDefault()
        setCollapsed(!collapsed)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [collapsed, setCollapsed])

  if (collapsed) return null
  return (
    <TooltipProvider>
      <nav
        aria-label="Primary"
        className="hidden w-16 shrink-0 flex-col border-r border-border bg-background px-2 pb-3 @3xl/iface:flex @7xl/iface:w-64 @7xl/iface:px-3"
      >
        <SidebarContent {...props} onCollapse={() => setCollapsed(true)} />
      </nav>
    </TooltipProvider>
  )
}

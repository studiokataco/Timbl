"use client"

import { useState } from "react"
import { Archive, Check, ChevronDown, ChevronLeft, Ellipsis, Menu, PanelLeftOpen, Pin, Search, SquarePen } from "lucide-react"
import { useEngine } from "@/components/agentic/engine/engine-context"
import { ModeSwitch } from "@/components/shared/mode-switch"
import { SIDEBAR_COLLAPSED_KEY, useStoredFlag } from "@/components/shared/use-stored-flag"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { ChatMenu, groupThreads, ThreadMarks, useHomeChats, useStartOfToday } from "./home-chats"

function IconTip({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

export function HomeLead() {
  const { copy } = useHomeChats()
  const [collapsed, setCollapsed] = useStoredFlag(SIDEBAR_COLLAPSED_KEY)
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={copy.menu}
        onClick={() => window.dispatchEvent(new Event("nav:open"))}
        className="size-11 @3xl/iface:hidden"
      >
        <Menu className="size-4" aria-hidden />
      </Button>
      {collapsed ? (
        <IconTip label={`${copy.openSidebar} ⌘\\`}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={copy.openSidebar}
            aria-keyshortcuts="Meta+Backslash"
            onClick={() => setCollapsed(false)}
            className="hidden @3xl/iface:inline-flex"
          >
            <PanelLeftOpen className="size-4" aria-hidden />
          </Button>
        </IconTip>
      ) : null}
    </>
  )
}

export function TimblModeSwitch() {
  const { dispatch } = useEngine()
  return <ModeSwitch value="timbl" onSwitch={(mode) => mode === "interface" && dispatch({ type: "handoff_out" })} />
}

export function ChatTitle() {
  const { copy, current, threads, chatId, openChat, newChat, listReady } = useHomeChats()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [archivedView, setArchivedView] = useState(false)
  const startOfToday = useStartOfToday()
  const needle = query.trim().toLowerCase()
  const matches = threads.filter((thread) => !needle || thread.title.toLowerCase().includes(needle))
  const archivedCount = threads.filter((thread) => thread.archived).length
  const groups = archivedView
    ? [{ key: "archived", label: copy.archived, rows: matches.filter((thread) => thread.archived) }]
    : groupThreads(matches, startOfToday).map((group) => ({ ...group, label: copy.sections[group.key] }))
  const title = current?.title ?? (listReady ? copy.untitled : "")

  return (
    <h1 className="flex min-w-0 items-center">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) {
            setQuery("")
            setArchivedView(false)
          }
        }}
      >
        <PopoverTrigger
          render={<Button type="button" variant="ghost" size="sm" className="-ml-1.5 h-8 min-w-0 max-w-80 shrink gap-1.5 px-2 text-sm font-medium text-foreground" />}
        >
          <span className="min-w-0 truncate">{title}</span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 gap-0 p-0">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.searchChats}
              aria-label={copy.searchChats}
              className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
          </div>
          <div className="max-h-80 overflow-y-auto p-1">
            {archivedView ? (
              <button
                type="button"
                onClick={() => setArchivedView(false)}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-caption text-muted-foreground hover:bg-secondary/60 hover:text-foreground focus-ring"
              >
                <ChevronLeft className="size-3.5" aria-hidden />
                {copy.backToChats}
              </button>
            ) : null}
            {groups.every((group) => group.rows.length === 0) ? (
              <p className="px-2 py-6 text-center text-caption text-muted-foreground">
                {needle ? copy.noMatches : archivedView ? copy.emptyArchived : copy.empty}
              </p>
            ) : null}
            {groups.map((group) =>
              group.rows.length ? (
                <div key={group.key} className="py-1">
                  <p className="px-2 pb-1 text-caption text-muted-foreground">{group.label}</p>
                  {group.rows.map((thread) => (
                    <button
                      key={thread.id}
                      type="button"
                      onClick={() => {
                        openChat(thread.id)
                        setOpen(false)
                      }}
                      aria-current={thread.id === chatId ? "page" : undefined}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-secondary/60 focus-ring"
                    >
                      <span className="min-w-0 flex-1 truncate">{thread.title}</span>
                      <ThreadMarks thread={thread} copy={copy} />
                      <Check className={cn("size-4 shrink-0", thread.id === chatId ? "opacity-100" : "opacity-0")} aria-hidden />
                    </button>
                  ))}
                </div>
              ) : null,
            )}
          </div>
          <div className="flex items-center gap-1 border-t border-border p-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                newChat()
                setOpen(false)
              }}
            >
              <SquarePen className="size-3.5" aria-hidden />
              {copy.newChat}
            </Button>
            {!archivedView && archivedCount ? (
              <Button type="button" variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={() => setArchivedView(true)}>
                <Archive className="size-3.5" aria-hidden />
                {copy.archived}
                <span className="tabular-nums">{archivedCount}</span>
              </Button>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
    </h1>
  )
}

export function ChatActions() {
  const { copy, current, newChat, togglePin } = useHomeChats()
  return (
    <span className="hidden items-center gap-1.5 @2xl/timbl:flex">
      <IconTip label={copy.newChat}>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={copy.newChat} onClick={() => newChat()}>
          <SquarePen className="size-4" aria-hidden />
        </Button>
      </IconTip>
      <IconTip label={current ? (current.pinned ? copy.unpin : copy.pin) : copy.sendFirst}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={current?.pinned ? copy.unpin : copy.pin}
          aria-pressed={current ? current.pinned : undefined}
          disabled={!current}
          onClick={() => current && togglePin(current)}
        >
          <Pin className={cn("size-4", current?.pinned && "fill-current")} aria-hidden />
        </Button>
      </IconTip>
      {current ? (
        <ChatMenu thread={current} />
      ) : (
        <IconTip label={copy.sendFirst}>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={copy.more} disabled>
            <Ellipsis className="size-4" aria-hidden />
          </Button>
        </IconTip>
      )}
    </span>
  )
}

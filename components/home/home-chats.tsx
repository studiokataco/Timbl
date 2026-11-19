"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { formatDistanceToNowStrict } from "date-fns"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Archive, ArchiveRestore, Ellipsis, Link2, Lock, Pencil, Trash2, Users } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { makeCopy, type Copy } from "@/components/agentic/copy"
import { useWorkspaceOrgId } from "@/components/shared/workspace-provider"
import { deleteAssistantThread, listAssistantThreads, updateAssistantThread } from "@/lib/actions/assistant-threads"
import { DEFAULT_APP_ROUTE } from "@/lib/constants/timbl"
import type { AssistantThreadListItem, AssistantThreadPatch } from "@/lib/schemas/assistantThread"
import { cn } from "@/lib/utils"

type HomeCopy = Copy["home"]

type HomeChats = {
  copy: HomeCopy
  onHome: boolean
  listReady: boolean
  threads: AssistantThreadListItem[]
  chatId: string
  current: AssistantThreadListItem | null
  lastChatId: string | null
  openChat: (id: string) => void
  newChat: () => void
  togglePin: (thread: AssistantThreadListItem) => void
  toggleArchive: (thread: AssistantThreadListItem) => void
  toggleShare: (thread: AssistantThreadListItem) => void
  copyLink: (thread: AssistantThreadListItem) => void
  askRename: (thread: AssistantThreadListItem) => void
  askDelete: (thread: AssistantThreadListItem) => void
  refresh: () => void
}

const HomeChatsContext = createContext<HomeChats | null>(null)
const NO_THREADS: AssistantThreadListItem[] = []

export function useHomeChats(): HomeChats {
  const value = useContext(HomeChatsContext)
  if (!value) throw new Error("useHomeChats needs HomeChatsProvider")
  return value
}

export function chatPath(id?: string | null): string {
  return id ? `${DEFAULT_APP_ROUTE}/${encodeURIComponent(id)}` : DEFAULT_APP_ROUTE
}

function chatFromPath(pathname: string): string | null {
  if (!pathname.startsWith(`${DEFAULT_APP_ROUTE}/`)) return null
  const id = pathname.slice(DEFAULT_APP_ROUTE.length + 1).split("/")[0]
  return id ? decodeURIComponent(id) : null
}

function lastChatKey(orgId: string): string {
  return `timbl:last-chat:${orgId}`
}

export function readLastChat(orgId: string): string | null {
  return typeof window === "undefined" ? null : window.localStorage.getItem(lastChatKey(orgId))
}

export function HomeChatsProvider({
  assistantName,
  initialNewChatId,
  children,
}: {
  assistantName: string
  initialNewChatId: string
  children: React.ReactNode
}) {
  const copy = useMemo(() => makeCopy(assistantName).home, [assistantName])
  const orgId = useWorkspaceOrgId()
  const pathname = usePathname()
  const router = useRouter()
  const qc = useQueryClient()
  const onHome = pathname === DEFAULT_APP_ROUTE || pathname.startsWith(`${DEFAULT_APP_ROUTE}/`)
  const [newChatId, setNewChatId] = useState(initialNewChatId)
  const [lastChatId, setLastChatId] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<AssistantThreadListItem | null>(null)
  const [deleting, setDeleting] = useState<AssistantThreadListItem | null>(null)
  const marked = useRef(new Set<string>())
  const queryKey = useMemo(() => ["assistant-threads", orgId], [orgId])
  const { data: threads = NO_THREADS, isSuccess: listReady } = useQuery({
    queryKey,
    queryFn: () => listAssistantThreads(),
    refetchInterval: onHome ? 5_000 : 30_000,
  })
  const chatId = chatFromPath(pathname) ?? newChatId
  const current = threads.find((thread) => thread.id === chatId) ?? null

  const refresh = useCallback(() => void qc.invalidateQueries({ queryKey }), [qc, queryKey])

  useEffect(() => {
    setLastChatId(readLastChat(orgId))
  }, [orgId])

  useEffect(() => {
    if (!current) return
    window.localStorage.setItem(lastChatKey(orgId), current.id)
    setLastChatId(current.id)
    if (window.location.pathname === DEFAULT_APP_ROUTE) {
      window.history.replaceState(null, "", `${chatPath(current.id)}${window.location.search}`)
    }
  }, [current, orgId])

  useEffect(() => {
    if (!current || !onHome) return
    if (!current.unread && marked.current.has(current.id)) return
    marked.current.add(current.id)
    void updateAssistantThread(current.id, { read: true }).then(refresh)
  }, [current, onHome, refresh])

  const openChat = useCallback(
    (id: string) => {
      if (onHome) window.history.pushState(null, "", chatPath(id))
      else router.push(chatPath(id))
    },
    [onHome, router],
  )

  const newChat = useCallback(() => {
    setNewChatId(crypto.randomUUID())
    if (onHome) window.history.pushState(null, "", DEFAULT_APP_ROUTE)
    else router.push(DEFAULT_APP_ROUTE)
  }, [onHome, router])

  const patchLocal = useCallback(
    (id: string, change: Partial<AssistantThreadListItem>) =>
      qc.setQueryData<AssistantThreadListItem[]>(queryKey, (rows) => rows?.map((row) => (row.id === id ? { ...row, ...change } : row))),
    [qc, queryKey],
  )

  const run = useCallback(
    async (id: string, patch: AssistantThreadPatch, change: Partial<AssistantThreadListItem>, onOk?: () => void) => {
      patchLocal(id, change)
      const result = await updateAssistantThread(id, patch)
      if (result.ok) onOk?.()
      else toast.error(result.error ?? copy.updateFailed)
      refresh()
    },
    [copy.updateFailed, patchLocal, refresh],
  )

  const togglePin = useCallback(
    (thread: AssistantThreadListItem) => void run(thread.id, { pinned: !thread.pinned }, { pinned: !thread.pinned }),
    [run],
  )

  const toggleShare = useCallback(
    (thread: AssistantThreadListItem) => {
      const visibility = thread.visibility === "workspace" ? "private" : "workspace"
      void run(thread.id, { visibility }, { visibility }, () => toast(visibility === "workspace" ? copy.shared : copy.madePrivate))
    },
    [copy.madePrivate, copy.shared, run],
  )

  const toggleArchive = useCallback(
    function toggle(thread: AssistantThreadListItem) {
      const archived = !thread.archived
      void run(thread.id, { archived }, { archived }, () =>
        toast(archived ? copy.archivedToast : copy.restoredToast, {
          ...(archived ? { action: { label: copy.undo, onClick: () => toggle({ ...thread, archived: true }) } } : {}),
        }),
      )
    },
    [copy.archivedToast, copy.restoredToast, copy.undo, run],
  )

  const copyLink = useCallback(
    (thread: AssistantThreadListItem) => {
      void navigator.clipboard.writeText(`${window.location.origin}${chatPath(thread.id)}`).then(
        () => {
          if (thread.visibility === "workspace" || !thread.mine) toast(copy.linkCopied)
          else toast(copy.linkCopied, { description: copy.linkPrivate, action: { label: copy.share, onClick: () => toggleShare(thread) } })
        },
        () => toast.error(copy.copyFailed),
      )
    },
    [copy.copyFailed, copy.linkCopied, copy.linkPrivate, copy.share, toggleShare],
  )

  const value = useMemo<HomeChats>(
    () => ({
      copy,
      onHome,
      listReady,
      threads,
      chatId,
      current,
      lastChatId,
      openChat,
      newChat,
      togglePin,
      toggleArchive,
      toggleShare,
      copyLink,
      askRename: setRenaming,
      askDelete: setDeleting,
      refresh,
    }),
    [chatId, copy, copyLink, current, lastChatId, listReady, newChat, onHome, openChat, refresh, threads, toggleArchive, togglePin, toggleShare],
  )

  return (
    <HomeChatsContext.Provider value={value}>
      {children}
      <RenameDialog
        key={renaming?.id ?? "none"}
        thread={renaming}
        copy={copy}
        onClose={() => setRenaming(null)}
        onSave={(title) => {
          if (renaming) void run(renaming.id, { title }, { title })
          setRenaming(null)
        }}
      />
      <DeleteDialog
        thread={deleting}
        copy={copy}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          const target = deleting
          setDeleting(null)
          if (!target) return
          qc.setQueryData<AssistantThreadListItem[]>(queryKey, (rows) => rows?.filter((row) => row.id !== target.id))
          const result = await deleteAssistantThread(target.id)
          if (!result.ok) toast.error(result.error ?? copy.updateFailed)
          else toast(copy.deleted)
          if (target.id === chatId) newChat()
          refresh()
        }}
      />
    </HomeChatsContext.Provider>
  )
}

function RenameDialog({
  thread,
  copy,
  onClose,
  onSave,
}: {
  thread: AssistantThreadListItem | null
  copy: HomeCopy
  onClose: () => void
  onSave: (title: string) => void
}) {
  const [value, setValue] = useState(thread?.title ?? "")
  const trimmed = value.trim()
  return (
    <Dialog open={Boolean(thread)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.renameTitle}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (trimmed) onSave(trimmed)
          }}
        >
          <Input autoFocus value={value} maxLength={120} onChange={(event) => setValue(event.target.value)} aria-label={copy.renameTitle} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {copy.cancel}
            </Button>
            <Button type="submit" disabled={!trimmed || trimmed === thread?.title}>
              {copy.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteDialog({
  thread,
  copy,
  onClose,
  onConfirm,
}: {
  thread: AssistantThreadListItem | null
  copy: HomeCopy
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={Boolean(thread)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.deleteTitle}</DialogTitle>
          <DialogDescription>{copy.deleteBody(thread?.title ?? "")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {copy.cancel}
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            {copy.deleteConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ChatMenu({
  thread,
  triggerClassName,
  align = "end",
}: {
  thread: AssistantThreadListItem
  triggerClassName?: string
  align?: "start" | "end"
}) {
  const { copy, copyLink, askRename, toggleShare, toggleArchive, askDelete } = useHomeChats()
  const locked = !thread.mine
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={`${copy.more}: ${thread.title}`} className={triggerClassName} />}
      >
        <Ellipsis className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuItem onClick={() => copyLink(thread)}>
          <Link2 aria-hidden />
          {copy.copyLink}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={locked} onClick={() => askRename(thread)}>
          <Pencil aria-hidden />
          {copy.rename}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={locked} onClick={() => toggleShare(thread)}>
          {thread.visibility === "workspace" ? <Lock aria-hidden /> : <Users aria-hidden />}
          {thread.visibility === "workspace" ? copy.makePrivate : copy.share}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={locked} onClick={() => toggleArchive(thread)}>
          {thread.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
          {thread.archived ? copy.restore : copy.archive}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={locked} onClick={() => askDelete(thread)}>
          <Trash2 aria-hidden />
          {copy.delete}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-caption font-normal text-muted-foreground">
          {copy.updated(formatDistanceToNowStrict(thread.lastAt))}
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export type ThreadGroup = { key: "pinned" | "today" | "week" | "older"; rows: AssistantThreadListItem[] }

export function groupThreads(rows: AssistantThreadListItem[], startOfToday: number): ThreadGroup[] {
  const weekStart = startOfToday - 6 * 86_400_000
  const live = rows.filter((row) => !row.archived)
  const groups: ThreadGroup[] = [
    { key: "pinned", rows: live.filter((row) => row.pinned) },
    { key: "today", rows: live.filter((row) => !row.pinned && row.lastAt >= startOfToday) },
    { key: "week", rows: live.filter((row) => !row.pinned && row.lastAt < startOfToday && row.lastAt >= weekStart) },
    { key: "older", rows: live.filter((row) => !row.pinned && row.lastAt < weekStart) },
  ]
  return groups.filter((group) => group.rows.length > 0)
}

export function useStartOfToday(): number {
  const [start] = useState(() => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    return date.getTime()
  })
  return start
}

export function ThreadMarks({ thread, copy, className }: { thread: AssistantThreadListItem; copy: HomeCopy; className?: string }) {
  return (
    <span className={cn("flex shrink-0 items-center gap-1.5", className)}>
      {thread.visibility === "workspace" ? <Users className="size-3.5 text-muted-foreground" aria-label={copy.sharedLabel} /> : null}
      {thread.needsYou ? (
        <span className="size-1.5 rounded-full bg-badge-orange">
          <span className="sr-only">{copy.needsYou}</span>
        </span>
      ) : thread.unread ? (
        <span className="size-1.5 rounded-full bg-brand-accent">
          <span className="sr-only">{copy.newReply}</span>
        </span>
      ) : null}
    </span>
  )
}

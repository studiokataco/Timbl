"use client"

import { useMemo, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { Bell } from "lucide-react"
import { formatDistanceToNowStrict } from "date-fns"
import { useQuery } from "@tanstack/react-query"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { fetchNotificationsAction } from "@/lib/actions/notifications"
import { postStatusLabel } from "@/lib/labels/enums"

const SEEN_KEY = "timbl:notifications:lastSeenAt"
const SEEN_EVENT = "timbl:notifications:seen"

function subscribeSeen(cb: () => void) {
  window.addEventListener(SEEN_EVENT, cb)
  return () => window.removeEventListener(SEEN_EVENT, cb)
}

function readSeen() {
  return localStorage.getItem(SEEN_KEY) ?? ""
}

function writeSeen(value: string) {
  localStorage.setItem(SEEN_KEY, value)
  window.dispatchEvent(new Event(SEEN_EVENT))
}

export function NotificationsMenu() {
  const router = useRouter()
  const lastSeen = useSyncExternalStore(subscribeSeen, readSeen, () => "")

  const { data: items = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotificationsAction(),
    refetchInterval: 60_000,
  })

  const unread = useMemo(
    () => items.filter((n) => !lastSeen || n.updatedAt > lastSeen).length,
    [items, lastSeen],
  )

  function onOpenChange(open: boolean) {
    if (open && items.length > 0) {
      writeSeen(items[0].updatedAt)
    }
  }

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        type="button"
        aria-label="Notifications"
        className="relative inline-flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
      >
        <Bell aria-hidden className="size-4" />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium leading-4 text-primary-foreground tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
          Notifications
        </div>
        {items.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            Nothing yet. Updates to your posts show up here.
          </div>
        ) : (
          <ul className="max-h-96 overflow-y-auto py-1">
            {items.map((n) => (
              <li key={n.postId}>
                <button
                  type="button"
                  onClick={() => router.push("/posts")}
                  className="flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-secondary/60"
                >
                  <span className="truncate text-[13px] text-foreground">
                    {n.brief}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Now {postStatusLabel(n.status)} ·{" "}
                    {formatDistanceToNowStrict(new Date(n.updatedAt), {
                      addSuffix: true,
                    })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

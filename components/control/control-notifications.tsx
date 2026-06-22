"use client"

import { useQuery } from "@tanstack/react-query"
import { Bell } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

import { ActionPill, SignalPill } from "@/components/control/audit-table"
import { OrgKey } from "@/components/control/org-key"
import { QueryProvider } from "@/components/shared/query-provider"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  getRecentPlatformNotifications,
  type PlatformNotification,
} from "@/lib/actions/platform/notifications"
import { relativeTime } from "@/lib/platform/format"
import type { PlatformAuditEntry, PlatformSignal } from "@/lib/platform/schema"

const LAST_SEEN_KEY = "control:notifications:last-seen"
const POLL_MS = 20_000

export function ControlNotifications() {
  return (
    <QueryProvider>
      <NotificationsBell />
    </QueryProvider>
  )
}

function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [lastSeen, setLastSeen] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem(LAST_SEEN_KEY),
  )

  const { data: entries = [] } = useQuery({
    queryKey: ["control", "notifications"],
    queryFn: () => getRecentPlatformNotifications(20),
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  })

  const newest = entries[0]?.createdAt ?? null
  const unread = useMemo(
    () => (lastSeen ? entries.filter((e) => e.createdAt > lastSeen).length : entries.length),
    [entries, lastSeen],
  )

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next && newest) {
      localStorage.setItem(LAST_SEEN_KEY, newest)
      setLastSeen(newest)
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        type="button"
        aria-label={unread > 0 ? `Notifications, ${unread} new` : "Notifications"}
        className="relative flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="size-[18px]" aria-hidden />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-4 text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          <span className="text-[11px] text-muted-foreground">Admin and tenant activity</span>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {entries.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Nothing yet.
            </p>
          ) : (
            entries.map((item) => (
              <NotificationRow
                key={item.type === "audit" ? item.entry.id : item.signal.id}
                item={item}
                unseen={!lastSeen || item.createdAt > lastSeen}
              />
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function NotificationRow({
  item,
  unseen,
}: {
  item: PlatformNotification
  unseen: boolean
}) {
  const href =
    item.type === "signal"
      ? signalHref(item.signal)
      : item.entry.targetOrgId
        ? `/tenants/${item.entry.targetOrgId}`
        : null

  const inner = (
    <div className="flex gap-2 border-t border-foreground/5 px-3 py-2.5 first:border-t-0 hover:bg-muted/40">
      <span
        aria-hidden
        className={`mt-1.5 size-1.5 shrink-0 rounded-full ${unseen ? "bg-red-500" : "bg-transparent"}`}
      />
      <div className="min-w-0 flex-1">
        {item.type === "audit" ? (
          <AuditNotificationRow entry={item.entry} createdAt={item.createdAt} />
        ) : (
          <SignalNotificationRow signal={item.signal} createdAt={item.createdAt} />
        )}
      </div>
    </div>
  )

  if (href) {
    return <Link href={href} className="block">{inner}</Link>
  }
  return inner
}

function AuditNotificationRow({
  entry,
  createdAt,
}: {
  entry: PlatformAuditEntry
  createdAt: string
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <ActionPill action={entry.action} />
        <span className="shrink-0 text-[11px] text-muted-foreground" title={createdAt}>
          {relativeTime(createdAt)}
        </span>
      </div>
      <p className="mt-1 truncate text-xs text-muted-foreground">{entry.actorEmail}</p>
      {entry.targetOrgId ? (
        <OrgKey orgId={entry.targetOrgId} className="-ml-1.5 mt-0.5" />
      ) : null}
    </>
  )
}

function SignalNotificationRow({
  signal,
  createdAt,
}: {
  signal: PlatformSignal
  createdAt: string
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <SignalPill kind={signal.kind} />
        <span className="shrink-0 text-[11px] text-muted-foreground" title={createdAt}>
          {relativeTime(createdAt)}
        </span>
      </div>
      <p className="mt-1 truncate text-xs text-foreground">{signal.summary}</p>
      {signalDetail(signal) ? (
        <p className="truncate text-xs text-muted-foreground">{signalDetail(signal)}</p>
      ) : null}
      {signal.orgId ? (
        <OrgKey orgId={signal.orgId} className="-ml-1.5 mt-0.5" />
      ) : null}
    </>
  )
}

function signalDetail(signal: PlatformSignal): string | null {
  const { meta } = signal
  if (signal.kind === "signup.requested") {
    const name = meta.name
    return typeof name === "string" ? name : null
  }
  if (signal.kind === "agent.failed") {
    const error = meta.error
    return typeof error === "string" && error ? error : null
  }
  if (signal.kind === "quota.breached") {
    const metric = meta.metric
    const used = meta.used
    const limit = meta.limit
    if (typeof metric === "string" && typeof used === "number" && typeof limit === "number") {
      return `${metric}: ${used}/${limit}`
    }
  }
  return null
}

function signalHref(signal: PlatformSignal): string | null {
  if (signal.kind === "signup.requested") return "/signups"
  if (signal.orgId) return `/tenants/${signal.orgId}`
  return null
}

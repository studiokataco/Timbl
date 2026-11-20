"use client"

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import { MousePointer2 } from "lucide-react"
import { PRESENCE_FILL, PRESENCE_RING, tw } from "@/components/agentic/lib"
import type { PresenceSlot, TeamMember } from "@/components/agentic/types"
import { listPresence, publishPresence } from "@/lib/actions/presence"

export type LiveCursor = {
  id: string
  userId?: string
  name: string
  slot: PresenceSlot
  x: number
  y: number
  at: number
  activity?: "idle" | "editing_caption"
}

const IDLE_MS = 15_000
// Server actions share the router's queue; fast polling starves client navigation.
const PRESENCE_SYNC_MS = 2_000

export type PeerElsewhere = { userId: string; weekStart: string }

const PresenceContext = createContext<{
  peers: LiveCursor[]
  elsewhere: PeerElsewhere[]
  send: (cursor: LiveCursor & { weekStart: string }) => void
}>({
  peers: [],
  elsewhere: [],
  send: () => {},
})

export function useLivePresence() {
  return useContext(PresenceContext)
}

export function LivePresence({
  hidden,
  weekStart,
  team,
  children,
}: {
  hidden: boolean
  weekStart: string
  team: TeamMember[]
  children: React.ReactNode
}) {
  const [cursors, setCursors] = useState<LiveCursor[]>([])
  const [elsewhere, setElsewhere] = useState<PeerElsewhere[]>([])
  const names = useMemo(() => new Map(team.map((member) => [member.id, member])), [team])

  useEffect(() => {
    if (hidden) return
    let alive = true
    const tick = async () => {
      const rows = await listPresence()
      if (!alive) return
      const now = Date.now()
      const live = rows.filter((row) => now - (Date.parse(row.updatedAt) || 0) < IDLE_MS)
      setCursors(
        live
          .filter((row) => row.weekStart === weekStart)
          .map((row) => {
            const member = names.get(row.userId)
            const day = row.day ?? 0
            const hour = row.hour ?? 9
            return {
              id: row.id,
              name: row.activity === "editing_caption"
                ? `${member?.name ?? "Teammate"} · Editing caption`
                : member?.name ?? "Teammate",
              slot: member?.presenceSlot ?? 1,
              x: (day + (row.fx ?? 0)) / 7,
              y: hour / 24,
              at: Date.parse(row.updatedAt) || now,
              activity: row.activity,
              userId: row.userId,
            }
          }),
      )
      setElsewhere(
        live
          .filter((row) => row.weekStart !== weekStart)
          .map((row) => ({ userId: row.userId, weekStart: row.weekStart })),
      )
    }
    let timer = 0
    const loop = async () => {
      if (document.visibilityState === "visible") await tick().catch(() => {})
      if (alive) timer = window.setTimeout(() => void loop(), PRESENCE_SYNC_MS)
    }
    void loop()
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [hidden, names, weekStart])

  const latest = useRef<LiveCursor & { weekStart: string }>(null)
  const sendTimer = useRef(0)
  useEffect(
    () => () => {
      window.clearTimeout(sendTimer.current)
      sendTimer.current = 0
    },
    [hidden],
  )

  const send = (cursor: LiveCursor & { weekStart: string }) => {
    if (hidden) return
    latest.current = cursor
    if (sendTimer.current) return
    sendTimer.current = window.setTimeout(() => {
      sendTimer.current = 0
      const last = latest.current
      if (!last) return
      const day = Math.min(6, Math.max(0, Math.floor(last.x * 7)))
      const hour = Math.min(24, Math.max(0, last.y * 24))
      void publishPresence({
        sessionId: last.id,
        surface: "calendar",
        weekStart: last.weekStart,
        day,
        hour,
        fx: last.x * 7 - day,
        fy: hour - Math.floor(hour),
        activity: last.activity === "editing_caption" ? "editing_caption" : "idle",
      })
    }, PRESENCE_SYNC_MS)
  }

  return (
    <PresenceContext.Provider value={{ peers: hidden ? [] : cursors, elsewhere: hidden ? [] : elsewhere, send }}>
      {children}
    </PresenceContext.Provider>
  )
}

export function CursorFrame({
  name,
  hidden,
  weekStart,
  children,
}: {
  name: string
  hidden: boolean
  weekStart: string
  children: React.ReactNode
}) {
  const frame = useRef<HTMLDivElement>(null)
  const { peers, send } = useContext(PresenceContext)

  useEffect(() => {
    if (window.sessionStorage.getItem("timbl-cursor-session")) return
    window.sessionStorage.setItem("timbl-cursor-session", crypto.randomUUID())
  }, [])

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = frame.current?.getBoundingClientRect()
    const id = window.sessionStorage.getItem("timbl-cursor-session")
    if (!box || !id || hidden) return
    send({
      id,
      name,
      slot: 2,
      x: (event.clientX - box.left) / box.width,
      y: (event.clientY - box.top) / box.height,
      at: Date.now(),
      weekStart,
    })
  }

  return (
    <div ref={frame} className="relative flex min-h-0 flex-1 flex-col" onPointerMove={onPointerMove}>
      {children}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 hidden @5xl/iface:block">
        {peers.map((cursor) => (
          <div
            key={cursor.id}
            data-cursor-id={cursor.id}
            className="absolute"
            style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%` }}
          >
            <MousePointer2 className={tw("size-4 shrink-0", PRESENCE_FILL[cursor.slot])} />
            <span
              className={tw(
                "absolute top-4 left-3 block h-5 w-max whitespace-nowrap rounded-md bg-background px-2 text-caption leading-5 font-medium text-foreground ring-2",
                PRESENCE_RING[cursor.slot],
              )}
            >
              {cursor.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

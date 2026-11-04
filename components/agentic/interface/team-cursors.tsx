"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { MousePointer2 } from "lucide-react"
import { addDays } from "../clock"
import { PRESENCE_FILL, PRESENCE_RING, tw } from "../lib"
import { useAgenticMotion, usePrototype } from "../prototype-context"
import type { CursorWaypoint, TeamMember, TeamPresence, WeekId } from "../types"

export type TeamCursorsProps = {
  presence: TeamPresence[]
  team: TeamMember[]
  viewerId: string
  week: WeekId
  mode: "live" | "idle" | "off"
  replayKey: number
  hidden: boolean
}

function dayIndexInWeek(day: string, week: WeekId): number {
  for (let i = 0; i < 7; i++) {
    if (addDays(week, i) === day) return i
  }
  return 0
}

export function TeamCursors({
  presence,
  team,
  viewerId,
  week,
  mode,
  replayKey,
  hidden,
}: TeamCursorsProps): React.JSX.Element | null {
  const { copy } = usePrototype()
  const { reduced } = useAgenticMotion()
  const [stepBySession, setStepBySession] = useState<Record<string, number>>({})
  const [idleSessions, setIdleSessions] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (mode !== "live" || hidden || week !== "2026-11-02") return
    const timers: number[] = []
    for (const p of presence) {
      if (p.userId === viewerId) continue
      p.path.forEach((wp, idx) => {
        if (idx === 0) return
        const id = window.setTimeout(() => {
          setStepBySession((prev) => ({ ...prev, [p.sessionId]: idx }))
        }, wp.atMs)
        timers.push(id)
      })
      const lastAt = p.path[p.path.length - 1]?.atMs ?? 0
      const idleTimer = window.setTimeout(() => {
        setIdleSessions((prev) => ({ ...prev, [p.sessionId]: true }))
      }, lastAt + p.idleAfterMs)
      timers.push(idleTimer)
    }
    return () => {
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [hidden, mode, presence, replayKey, viewerId, week])

  if (mode === "off" || mode === "idle" || hidden || week !== "2026-11-02") return null

  return (
    <div
      aria-hidden="true"
      data-slot="agentic-team-cursors"
      data-state={mode}
      data-figma="TeamCursors/root"
      className="pointer-events-none absolute inset-0 z-20 hidden @3xl/iface:block"
    >
      {presence
        .filter((p) => p.userId !== viewerId && !idleSessions[p.sessionId])
        .map((p) => {
          const member = team.find((m) => m.id === p.userId)
          if (!member) return null
          const idx = stepBySession[p.sessionId] ?? 0
          const wp: CursorWaypoint = p.path[idx] ?? p.path[0]!
          const dayIdx = dayIndexInWeek(wp.day, week)
          const left = `${(((dayIdx + wp.fx) / 7) * 100).toFixed(2)}%`
          const top = `${(((wp.hour - 9 + wp.fy) / 10) * 100).toFixed(2)}%`
          const label =
            wp.activity === "editing_caption"
              ? `${member.name} · ${copy.iface.cursors.editingCaption}`
              : member.name
          const Wrapper = reduced ? "div" : motion.div
          return (
            <Wrapper
              key={p.sessionId}
              data-figma={`TeamCursors/${member.id}`}
              style={{ left, top }}
              {...(reduced
                ? {}
                : {
                    animate: { left, top },
                    transition: { duration: 0.1, ease: "linear" as const },
                  })}
              className="absolute"
            >
              <span
                className={tw(
                  "absolute bottom-full left-3 mb-1 block h-5 w-max whitespace-nowrap rounded-md bg-background px-2 text-caption leading-5 font-medium text-foreground ring-2",
                  PRESENCE_RING[member.presenceSlot],
                )}
              >
                {label}
              </span>
              <MousePointer2 className={tw("size-4 shrink-0", PRESENCE_FILL[member.presenceSlot])} />
            </Wrapper>
          )
        })}
    </div>
  )
}

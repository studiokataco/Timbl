"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import { MousePointer2 } from "lucide-react"
import { PRESENCE_FILL, PRESENCE_RING, tw } from "@/components/mockup/agentic/lib"
import type { PresenceSlot } from "@/components/mockup/agentic/types"

export type LiveCursor = { id: string; name: string; slot: PresenceSlot; x: number; y: number; at: number }

const IDLE_MS = 15_000

const PresenceContext = createContext<{ peers: LiveCursor[]; send: (cursor: LiveCursor) => void }>({
  peers: [],
  send: () => {},
})

export function LivePresence({ hidden, children }: { hidden: boolean; children: React.ReactNode }) {
  const self = useRef("")
  const channel = useRef<BroadcastChannel | null>(null)
  const [cursors, setCursors] = useState<LiveCursor[]>([])

  useEffect(() => {
    const key = "timbl-cursor-session"
    let id = window.sessionStorage.getItem(key)
    if (!id) {
      id = crypto.randomUUID()
      window.sessionStorage.setItem(key, id)
    }
    self.current = id
    const bus = new BroadcastChannel("timbl-calendar-cursors")
    channel.current = bus
    const onMessage = (event: MessageEvent<LiveCursor>) => {
      const cursor = event.data
      if (!cursor || cursor.id === self.current) return
      setCursors((prev) => [...prev.filter((item) => item.id !== cursor.id), cursor])
    }
    bus.addEventListener("message", onMessage)
    const sweep = window.setInterval(() => {
      const now = Date.now()
      setCursors((prev) => prev.filter((item) => now - item.at < IDLE_MS))
    }, 1000)
    return () => {
      bus.removeEventListener("message", onMessage)
      bus.close()
      channel.current = null
      window.clearInterval(sweep)
    }
  }, [])

  const send = (cursor: LiveCursor) => {
    if (hidden) return
    channel.current?.postMessage(cursor)
  }
  const peers = hidden ? [] : cursors

  return <PresenceContext.Provider value={{ peers, send }}>{children}</PresenceContext.Provider>
}

export function CursorFrame({
  name,
  hidden,
  children,
}: {
  name: string
  hidden: boolean
  children: React.ReactNode
}) {
  const frame = useRef<HTMLDivElement>(null)
  const lastSent = useRef(0)
  const { peers, send } = useContext(PresenceContext)

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = frame.current?.getBoundingClientRect()
    const id = window.sessionStorage.getItem("timbl-cursor-session")
    if (!box || !id || hidden) return
    const now = Date.now()
    if (now - lastSent.current < 100) return
    lastSent.current = now
    send({
      id,
      name,
      slot: 2,
      x: (event.clientX - box.left) / box.width,
      y: (event.clientY - box.top) / box.height,
      at: now,
    })
  }

  return (
    <div ref={frame} className="relative" onPointerMove={onPointerMove}>
      {children}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20">
        {peers.map((cursor) => (
          <div
            key={cursor.id}
            data-cursor-id={cursor.id}
            className="absolute"
            style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%` }}
          >
            <span
              className={tw(
                "absolute bottom-full left-3 mb-1 block h-5 w-max whitespace-nowrap rounded-md bg-background px-2 text-caption leading-5 font-medium text-foreground ring-2",
                PRESENCE_RING[cursor.slot],
              )}
            >
              {cursor.name}
            </span>
            <MousePointer2 className={tw("size-4 shrink-0", PRESENCE_FILL[cursor.slot])} />
          </div>
        ))}
      </div>
    </div>
  )
}

"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type Point = { x: number; y: number }

const DRAG_PX = 6
const PAD = 8

function storageKey(userId: string) {
  return `timbl-agentic-orb:${userId}`
}

function readPoint(userId: string): Point | null {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Point
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number") return null
    return parsed
  } catch {
    return null
  }
}

function clamp(point: Point, parent: DOMRect, box: DOMRect): Point {
  const maxX = Math.max(PAD, parent.width - box.width - PAD)
  const maxY = Math.max(PAD, parent.height - box.height - PAD)
  return {
    x: Math.min(maxX, Math.max(PAD, point.x)),
    y: Math.min(maxY, Math.max(PAD, point.y)),
  }
}

export function useOrbDrag(
  userId: string,
  boundsRef: React.RefObject<HTMLElement | null>,
  dockRef: React.RefObject<HTMLDivElement | null>,
) {
  const [point, setPoint] = useState<Point | null>(null)
  const drag = useRef<{
    pointerId: number
    capture: Element
    startX: number
    startY: number
    originX: number
    originY: number
    moved: boolean
  } | null>(null)
  const latest = useRef<Point | null>(null)
  const suppressClick = useRef(false)

  useEffect(() => {
    const saved = readPoint(userId)
    if (!saved) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPoint(saved)
  }, [userId])

  const place = useCallback(
    (next: Point) => {
      const parent = boundsRef.current
      const dock = dockRef.current
      if (!parent || !dock) {
        setPoint(next)
        return
      }
      const clamped = clamp(next, parent.getBoundingClientRect(), dock.getBoundingClientRect())
      latest.current = clamped
      setPoint(clamped)
    },
    [boundsRef, dockRef],
  )

  const placed = point !== null
  useEffect(() => {
    const parent = boundsRef.current
    if (!parent || !placed) return
    const ro = new ResizeObserver(() => {
      const dock = dockRef.current
      if (!dock) return
      setPoint((current) => {
        if (!current) return current
        const next = clamp(current, parent.getBoundingClientRect(), dock.getBoundingClientRect())
        if (next.x === current.x && next.y === current.y) return current
        localStorage.setItem(storageKey(userId), JSON.stringify(next))
        return next
      })
    })
    ro.observe(parent)
    return () => ro.disconnect()
  }, [boundsRef, dockRef, placed, userId])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const parent = boundsRef.current
    const dock = dockRef.current
    if (!parent || !dock) return
    const parentRect = parent.getBoundingClientRect()
    const dockRect = dock.getBoundingClientRect()
    const capture = event.target instanceof Element ? event.target : event.currentTarget
    drag.current = {
      pointerId: event.pointerId,
      capture,
      startX: event.clientX,
      startY: event.clientY,
      originX: dockRect.left - parentRect.left,
      originY: dockRect.top - parentRect.top,
      moved: false,
    }
    try {
      capture.setPointerCapture(event.pointerId)
    } catch {
      /* Synthetic pointers cannot be captured. Moves still bubble while the pointer stays over the dock. */
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const session = drag.current
    if (!session || session.pointerId !== event.pointerId) return
    const dx = event.clientX - session.startX
    const dy = event.clientY - session.startY
    if (!session.moved && Math.hypot(dx, dy) < DRAG_PX) return
    session.moved = true
    place({ x: session.originX + dx, y: session.originY + dy })
  }

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const session = drag.current
    if (!session || session.pointerId !== event.pointerId) return
    drag.current = null
    if (session.moved) {
      suppressClick.current = true
      const saved = latest.current
      if (saved) {
        setPoint(saved)
        localStorage.setItem(storageKey(userId), JSON.stringify(saved))
      }
    }
    try {
      if (session.capture.hasPointerCapture(event.pointerId)) {
        session.capture.releasePointerCapture(event.pointerId)
      }
    } catch {
      /* Pointer was never captured. */
    }
  }

  const onClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!suppressClick.current) return
    suppressClick.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  return { point, onPointerDown, onPointerMove, onPointerUp, onClickCapture }
}

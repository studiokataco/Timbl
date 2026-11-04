"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { DUR, EASE_OUT, TOUCH, tw } from "../lib"
import { useAgenticMotion, usePrototype } from "../prototype-context"

export type CanvasBottomSheetProps = {
  detent: "peek" | "half" | "full"
  onDetentChange: (d: "peek" | "half" | "full") => void
  onHeightChange: (px: number) => void
  title: string
  meta: string
  children: React.ReactNode
  hasCard: boolean
  working?: React.ReactNode
}

const ORDER: ("peek" | "half" | "full")[] = ["peek", "half", "full"]

export function CanvasBottomSheet({
  detent,
  onDetentChange,
  onHeightChange,
  title,
  meta,
  children,
  hasCard,
  working,
}: CanvasBottomSheetProps): React.JSX.Element {
  const { copy } = usePrototype()
  const { reduced } = useAgenticMotion()
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const [parentHeight, setParentHeight] = useState(640)

  useEffect(() => {
    const parent = sheetRef.current?.parentElement
    if (!parent || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? 640
      setParentHeight(Math.max(240, h))
    })
    ro.observe(parent)
    return () => ro.disconnect()
  }, [])

  const targetPx =
    detent === "peek"
      ? 88
      : detent === "half"
        ? Math.round(parentHeight * 0.5)
        : Math.max(220, parentHeight - 8)

  useEffect(() => {
    onHeightChange(targetPx)
  }, [targetPx, onHeightChange])

  const cycle = () => {
    const idx = ORDER.indexOf(detent)
    const next = ORDER[(idx + 1) % ORDER.length] ?? "peek"
    onDetentChange(next)
  }

  const onGrabberKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const idx = ORDER.indexOf(detent)
    if (e.key === "ArrowUp" && idx < ORDER.length - 1) {
      e.preventDefault()
      onDetentChange(ORDER[idx + 1]!)
    } else if (e.key === "ArrowDown" && idx > 0) {
      e.preventDefault()
      onDetentChange(ORDER[idx - 1]!)
    }
  }

  const label = copy.mobile.sheet.grabber(copy.mobile.sheet.detents[detent])

  return (
    <motion.section
      ref={sheetRef}
      aria-label={title}
      data-slot="agentic-canvas-bottom-sheet"
      data-state={detent}
      data-figma="CanvasBottomSheet/root"
      animate={{ height: targetPx }}
      transition={reduced ? { duration: 0 } : { duration: DUR.enter, ease: EASE_OUT }}
      className="absolute inset-x-0 bottom-0 z-20 flex flex-col overflow-hidden rounded-t-2xl border-t border-border bg-background shadow-sm dark:bg-card"
    >
      <button
        type="button"
        aria-label={label}
        onClick={cycle}
        onKeyDown={onGrabberKeyDown}
        data-figma="CanvasBottomSheet/grabber"
        className={tw(
          "flex w-full shrink-0 flex-col items-center justify-center gap-1.5 border-b border-border px-4 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          TOUCH.grabber,
        )}
      >
        <span aria-hidden="true" className="h-1 w-10 rounded-full bg-surface-strong" />
        <span className="flex w-full items-center justify-between gap-2">
          <span className="text-caption font-medium text-foreground">{hasCard ? title : copy.canvas.emptyTitle}</span>
          <span className="truncate text-caption text-muted-foreground">{meta}</span>
        </span>
      </button>
      {working ? <div className="px-4 pt-2">{working}</div> : null}
      {detent !== "peek" ? (
        <div data-figma="CanvasBottomSheet/body" className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {children}
        </div>
      ) : null}
    </motion.section>
  )
}

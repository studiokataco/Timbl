"use client"

import { useEffect, useId, useRef } from "react"
import { motion } from "framer-motion"
import { DUR, EASE_OUT, tw } from "../lib"
import { useAgenticMotion } from "../prototype-context"

export type FrameSheetProps = {
  open: boolean
  onClose: () => void
  title: string
  hideTitle?: boolean
  size?: "sheet" | "full"
  dark?: boolean
  finalFocus?: () => HTMLElement | null
  children: React.ReactNode
}

const FOCUSABLE = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex='0']"

export function FrameSheet({
  open,
  onClose,
  title,
  hideTitle = false,
  size = "sheet",
  dark = false,
  finalFocus,
  children,
}: FrameSheetProps): React.JSX.Element | null {
  const { reduced } = useAgenticMotion()
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement | null>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
    return () => {
      const target = finalFocus?.() ?? openerRef.current
      target?.focus()
    }
  }, [open, finalFocus])

  if (!open) return null

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== "Tab") return
    const panel = panelRef.current
    if (!panel) return
    const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
    if (nodes.length === 0) return
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last?.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first?.focus()
    }
  }

  return (
    <div
      data-slot="agentic-frame-sheet"
      data-state={size}
      data-figma="FrameSheet/root"
      className="absolute inset-0 z-40 flex flex-col justify-end"
      onKeyDown={onKeyDown}
    >
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-surface-dark/30"
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ duration: DUR.enter, ease: EASE_OUT }}
        className={tw(
          "relative z-10 flex flex-col overflow-y-auto",
          size === "full" ? "inset-0 size-full" : "max-h-9/10 rounded-t-2xl bg-background p-4 text-foreground shadow-sm",
          dark && "dark",
        )}
      >
        <h2 id={titleId} className={hideTitle ? "sr-only" : "mb-3 text-title-md text-foreground"}>
          {title}
        </h2>
        {children}
      </motion.div>
    </div>
  )
}

"use client"

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react"
import { DUR } from "../lib"
import { useAnnounce } from "../live-announcer"
import { useAgenticMotion, usePrototype } from "../prototype-context"
import type { WeekId } from "../types"

export type HandoffPhase = "idle" | "in-leaving" | "in-settling" | "out-leaving" | "out-landing"

export type HandoffContextValue = {
  phase: HandoffPhase
  origin: { x: number; y: number }
  carryText: string | null
  orbRef: React.RefObject<HTMLDivElement | null>
  triggerIn: (opts: { carryText?: string | null; onSwap: () => void }) => void
  triggerOut: (opts: { week?: WeekId; post?: string; onSwap: () => void }) => void
}

const HandoffContext = createContext<HandoffContextValue | null>(null)

export function HandoffProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { copy } = usePrototype()
  const { reduced } = useAgenticMotion()
  const announce = useAnnounce()
  const orbRef = useRef<HTMLDivElement | null>(null)
  const [phase, setPhase] = useState<HandoffPhase>("idle")
  const [origin, setOrigin] = useState<{ x: number; y: number }>({ x: 1200, y: 800 })
  const [carryText, setCarryText] = useState<string | null>(null)

  const readOrbCenter = useCallback(() => {
    const rect = orbRef.current?.getBoundingClientRect()
    if (rect) {
      return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) }
    }
    if (typeof window !== "undefined") {
      return { x: Math.round(window.innerWidth - 64), y: Math.round(window.innerHeight - 64) }
    }
    return { x: 1200, y: 800 }
  }, [])

  const triggerIn = useCallback(
    ({ carryText: chip, onSwap }: { carryText?: string | null; onSwap: () => void }) => {
      const pt = readOrbCenter()
      setOrigin(pt)
      setCarryText(chip ?? null)
      setPhase("in-leaving")
      const morphMs = reduced ? Math.round(DUR.fade * 1000) : Math.round(DUR.morph * 1000)
      const settleMs = reduced ? 80 : Math.round(DUR.appear * 1000)
      window.setTimeout(() => {
        onSwap()
        announce(copy.flyout.announceIn)
        setPhase("in-settling")
        window.setTimeout(() => {
          setPhase("idle")
          setCarryText(null)
          document.querySelector<HTMLTextAreaElement>("#timbl-composer")?.focus()
        }, settleMs)
      }, morphMs)
    },
    [announce, copy.flyout.announceIn, readOrbCenter, reduced],
  )

  const triggerOut = useCallback(
    ({ post, onSwap }: { week?: WeekId; post?: string; onSwap: () => void }) => {
      const pt = readOrbCenter()
      setOrigin(pt)
      setCarryText(null)
      setPhase("out-leaving")
      const leaveMs = reduced ? 40 : Math.round(DUR.exit * 1000)
      const landMs = reduced ? Math.round(DUR.fade * 1000) : 280
      window.setTimeout(() => {
        onSwap()
        announce(copy.flyout.announceOut)
        setPhase("out-landing")
        window.setTimeout(() => {
          setPhase("idle")
          if (post) {
            document.querySelector<HTMLElement>(`[data-post-id="${post}"]`)?.focus()
          } else {
            document.querySelector<HTMLElement>("[data-slot=agentic-orb-dock] button")?.focus()
          }
        }, landMs)
      }, leaveMs)
    },
    [announce, copy.flyout.announceOut, readOrbCenter, reduced],
  )

  const value = useMemo<HandoffContextValue>(
    () => ({ phase, origin, carryText, orbRef, triggerIn, triggerOut }),
    [phase, origin, carryText, triggerIn, triggerOut],
  )

  return <HandoffContext.Provider value={value}>{children}</HandoffContext.Provider>
}

export function useHandoff(): HandoffContextValue {
  const ctx = useContext(HandoffContext)
  if (!ctx) throw new Error("useHandoff needs HandoffProvider")
  return ctx
}

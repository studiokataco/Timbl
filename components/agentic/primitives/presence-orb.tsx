"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useAnimate } from "framer-motion"
import { Mic } from "lucide-react"
import { usePrototype, useAgenticMotion } from "../prototype-context"
import { DUR, EASE_OUT, SPRING, tw } from "../lib"
import type { PresenceOrbState } from "../types"
import { ORB_LABEL_KEY, orbTransition } from "./orb-machine"

type OrbSize = "xs" | "sm" | "md" | "dock" | "talk"

export type PresenceOrbProps = {
  state: PresenceOrbState
  size: OrbSize
  largeTarget?: boolean
  level?: number
  showLabel?: boolean
  label?: string
  interactive?: { onPress: () => void; onHoldStart?: () => void; onHoldEnd?: () => void; ariaLabel: string }
  className?: string
}

const HOLD_MS = 250

const BODY_SIZE: Record<OrbSize, string> = {
  "xs": "size-6",
  "sm": "size-8",
  "md": "size-12",
  "dock": "size-14",
  "talk": "size-24",
}

const ICON_SIZE: Record<OrbSize, string> = {
  "xs": "size-3",
  "sm": "size-4",
  "md": "size-5",
  "dock": "size-5",
  "talk": "size-8",
}

function clampLevel(level: number | undefined): number {
  if (level === undefined || Number.isNaN(level)) return 0
  return Math.min(1, Math.max(0, level))
}

function OrbCore({ state, size }: { state: PresenceOrbState; size: OrbSize }) {
  const icon = tw("shrink-0", ICON_SIZE[size])
  if (size === "talk" && state === "listening") return <span className="size-6 rounded-md bg-primary-foreground" />
  if (size === "talk" && state === "idle") return <Mic className={icon} aria-hidden />
  return null
}

function useHoldHandlers(interactive: PresenceOrbProps["interactive"]) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)
  const spaceDown = useRef(false)
  const [holding, setHolding] = useState(false)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  if (!interactive) return null

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  const startHold = () => {
    held.current = true
    setHolding(true)
    interactive.onHoldStart?.()
  }
  const endHold = () => {
    held.current = false
    setHolding(false)
    interactive.onHoldEnd?.()
  }

  return {
    holding,
    handlers: {
      onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0) return
        event.currentTarget.setPointerCapture(event.pointerId)
        clearTimer()
        timer.current = setTimeout(() => {
          timer.current = null
          startHold()
        }, HOLD_MS)
      },
      onPointerUp: () => {
        const wasHold = held.current
        clearTimer()
        if (wasHold) endHold()
        else interactive.onPress()
      },
      onPointerCancel: () => {
        clearTimer()
        if (held.current) endHold()
      },
      onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
        if (event.detail !== 0) return
        interactive.onPress()
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== " " && event.code !== "Space") return
        event.preventDefault()
        if (event.repeat || spaceDown.current) return
        spaceDown.current = true
        startHold()
      },
      onKeyUp: (event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== " " && event.code !== "Space") return
        event.preventDefault()
        if (!spaceDown.current) return
        spaceDown.current = false
        endHold()
      },
      onBlur: () => {
        if (spaceDown.current) {
          spaceDown.current = false
          endHold()
        }
      },
    },
  }
}

export function PresenceOrb({
  state,
  size,
  level,
  showLabel = false,
  label,
  interactive,
  className,
}: PresenceOrbProps): React.JSX.Element {
  const { copy } = usePrototype()
  const { reduced } = useAgenticMotion()
  const [scope, animate] = useAnimate<HTMLSpanElement>()
  const previous = useRef<PresenceOrbState>("idle")
  const hold = useHoldHandlers(size === "talk" ? interactive : undefined)

  useEffect(() => {
    const transition = orbTransition(previous.current, state)
    previous.current = state
    if (!transition || reduced || !scope.current) return
    if (transition.pop) {
      animate(scope.current, { scale: [1, 1.12, 1] }, { duration: DUR.pop, times: [0, 0.4, 1], ease: EASE_OUT })
    }
  }, [state, reduced, animate, scope])

  const fade = (duration: number) => (reduced ? { duration: 0 } : { duration, ease: EASE_OUT })
  const isTalk = size === "talk"
  const labelKey = ORB_LABEL_KEY[state]
  const labelText = label ?? (labelKey ? copy.orb.label[labelKey] : null)
  const pillVisible = size === "dock" && showLabel && state !== "idle" && labelText
  const lvl = clampLevel(level)
  const bodySize = BODY_SIZE[size]

  const body = (
    <motion.span
      ref={scope}
      data-figma="PresenceOrb/body"
      data-state={state}
      data-reduced={reduced ? "" : undefined}
      className={tw("timbl-orb-wrap", bodySize)}
    >
      <span className="timbl-orb-aura" aria-hidden />
      <span className="timbl-orb" aria-hidden>
        <span className="timbl-orb-world">
          <span className="timbl-orb-light timbl-orb-light-emerald" />
          <span className="timbl-orb-light timbl-orb-light-violet" />
          <span className="timbl-orb-light timbl-orb-light-coral" />
          <span className="timbl-orb-fold timbl-orb-fold-a" />
          <span className="timbl-orb-fold timbl-orb-fold-b" />
        </span>
        <span className="timbl-orb-grain" />
        <span className="timbl-orb-glass" />
      </span>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={isTalk && (state === "idle" || state === "listening") ? `talk-${state}` : state}
          data-figma="PresenceOrb/core"
          className="relative z-10 grid place-items-center"
          initial={state === "done" ? { opacity: 0, scale: reduced ? 1 : 0.8 } : false}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 0 } }}
          transition={fade(DUR.enter)}
        >
          <OrbCore state={state} size={size} />
        </motion.span>
      </AnimatePresence>
    </motion.span>
  )

  const talkRings = isTalk && state === "listening" && (
    <>
      {reduced ? (
        <span data-figma="PresenceOrb/halo" className="pointer-events-none absolute inset-0 scale-120 rounded-full bg-brand-accent/30 opacity-30" />
      ) : (
        <>
          <motion.span
            data-figma="PresenceOrb/halo"
            className="pointer-events-none absolute inset-0 rounded-full bg-brand-accent/20"
            initial={false}
            animate={{ scale: 1 + lvl * 0.7, opacity: 0.45 * lvl }}
            transition={SPRING}
          />
          <motion.span
            data-figma="PresenceOrb/halo"
            className="pointer-events-none absolute inset-0 rounded-full bg-brand-accent/30"
            initial={false}
            animate={{ scale: 1 + lvl * 0.5, opacity: 0.45 * lvl }}
            transition={SPRING}
          />
        </>
      )}
    </>
  )

  const pill = size === "dock" && showLabel && (
    <AnimatePresence initial={false}>
      {pillVisible && (
        <motion.span
          key="label"
          data-figma="PresenceOrb/label"
          className="inline-flex h-8 items-center rounded-full border border-border bg-background px-3 text-foreground"
          initial={{ opacity: 0, x: reduced ? 0 : 4 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, transition: fade(DUR.exit) }}
          transition={fade(DUR.enter)}
        >
          <span className="text-caption whitespace-nowrap">{labelText}</span>
        </motion.span>
      )}
    </AnimatePresence>
  )

  const rootClass = tw("relative inline-flex shrink-0 items-center gap-2", className)

  if (isTalk && interactive && hold) {
    return (
      <button
        type="button"
        aria-label={interactive.ariaLabel}
        data-slot="agentic-presence-orb"
        data-state={state}
        data-size={size}
        data-hold={hold.holding ? "" : undefined}
        data-figma="PresenceOrb"
        className={tw(
          rootClass,
          "touch-none rounded-full select-none outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        )}
        {...hold.handlers}
      >
        {talkRings}
        {body}
      </button>
    )
  }

  return (
    <span
      aria-hidden="true"
      data-slot="agentic-presence-orb"
      data-state={state}
      data-size={size}
      data-figma="PresenceOrb"
      className={rootClass}
    >
      {pill}
      {talkRings}
      {body}
    </span>
  )
}

export function AssistantAvatar(): React.JSX.Element {
  return <PresenceOrb size="xs" state="idle" />
}

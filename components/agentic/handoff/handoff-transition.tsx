"use client"

import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { DUR, EASE_IN, EASE_OUT } from "../lib"
import { useAgenticMotion, usePrototype } from "../prototype-context"
import { useHandoff } from "./handoff-context"

export type HandoffTransitionProps = {
  staticPhase?: "in-start" | "in-end" | "out-start" | "out-end"
  origin?: { x: number; y: number }
}

export function HandoffTransition({ staticPhase, origin: staticOrigin }: HandoffTransitionProps): React.JSX.Element | null {
  const { copy } = usePrototype()
  const { reduced } = useAgenticMotion()

  if (staticPhase) {
    const pt = staticOrigin ?? { x: 640, y: 420 }
    const small = staticPhase === "in-start" || staticPhase === "out-end"
    const clipPath = small ? `circle(28px at ${pt.x}px ${pt.y}px)` : `circle(1800px at ${pt.x}px ${pt.y}px)`
    return (
      <div
        aria-hidden="true"
        data-slot="agentic-handoff-transition"
        data-state={staticPhase}
        data-figma="HandoffTransition/root"
        style={{ clipPath }}
        className="pointer-events-none absolute inset-0 z-40 grid place-items-center bg-background"
      >
        {staticPhase === "in-end" ? (
          <Badge variant="outline" className="px-3 py-1">
            <span>{copy.flyout.carryChat(2)}</span>
          </Badge>
        ) : null}
      </div>
    )
  }

  return <LiveHandoffTransition reduced={reduced} />
}

function LiveHandoffTransition({ reduced }: { reduced: boolean }): React.JSX.Element | null {
  const { phase, origin, carryText } = useHandoff()
  if (phase === "idle" || phase === "in-settling" || phase === "out-leaving") return null

  const isIn = phase === "in-leaving"
  const startCircle = isIn ? `circle(28px at ${origin.x}px ${origin.y}px)` : `circle(2200px at ${origin.x}px ${origin.y}px)`
  const endCircle = isIn ? `circle(2200px at ${origin.x}px ${origin.y}px)` : `circle(28px at ${origin.x}px ${origin.y}px)`

  return (
    <motion.div
      aria-hidden="true"
      data-slot="agentic-handoff-transition"
      data-state={phase}
      data-figma="HandoffTransition/root"
      initial={reduced ? { opacity: isIn ? 0 : 1 } : { clipPath: startCircle }}
      animate={reduced ? { opacity: isIn ? 1 : 0 } : { clipPath: endCircle }}
      transition={
        reduced
          ? { duration: DUR.fade }
          : { duration: isIn ? DUR.morph : 0.28, ease: isIn ? EASE_OUT : EASE_IN }
      }
      className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-background"
    >
      {isIn && carryText ? (
        <Badge variant="outline" className="px-3 py-1">
          <span>{carryText}</span>
        </Badge>
      ) : null}
    </motion.div>
  )
}

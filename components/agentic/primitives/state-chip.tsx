"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { useAgenticMotion, usePrototype } from "../prototype-context"
import { DUR, EASE_OUT, TOUCH, tw } from "../lib"
import type { StateChipState } from "../types"

type StateChipProps = {
  state: StateChipState
  label: string
  shortLabel: string
  density: "touch" | "pointer"
  onOpen?: () => void
  expanded?: boolean
  controls?: string
}

const DOT: Record<StateChipState, string> = {
  working: "bg-brand-accent",
  needs_you: "bg-warning",
  error: "bg-destructive",
  done: "bg-success",
}

export function StateChip({ state, label, shortLabel, density, onOpen, expanded, controls }: StateChipProps): React.JSX.Element {
  const { copy } = usePrototype()
  const { reduced } = useAgenticMotion()
  const swap = reduced ? { duration: 0 } : { duration: DUR.fade, ease: EASE_OUT }
  const offset = reduced ? 0 : 4

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-slot="agentic-state-chip"
      data-state={state}
      data-figma="StateChip/root"
      aria-label={copy.chip.name(label, copy.chip.open)}
      aria-haspopup={onOpen ? "dialog" : undefined}
      aria-expanded={onOpen ? Boolean(expanded) : undefined}
      aria-controls={onOpen ? controls : undefined}
      onClick={onOpen}
      className={tw("rounded-full gap-2 px-3", density === "touch" && TOUCH.control)}
    >
      <span
        aria-hidden="true"
        data-figma="StateChip/dot"
        className={tw("size-2 shrink-0 rounded-full transition-colors duration-150 in-data-reduced-motion:transition-none", DOT[state])}
      />
      <span data-figma="StateChip/label" className="relative inline-flex overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={`${label}|${shortLabel}`}
            initial={{ opacity: 0, y: offset }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -offset }}
            transition={swap}
            className="inline-flex"
          >
            <span className="hidden text-xs font-medium @3xl:inline">{label}</span>
            <span className="text-xs font-medium @3xl:hidden">{shortLabel}</span>
          </motion.span>
        </AnimatePresence>
      </span>
    </Button>
  )
}

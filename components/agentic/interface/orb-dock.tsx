"use client"

import { forwardRef } from "react"
import { PresenceOrb } from "../primitives/presence-orb"
import { usePrototype } from "../prototype-context"
import type { PresenceOrbState } from "../types"

export type OrbDockProps = {
  state: PresenceOrbState
  label?: string
  largeTarget: boolean
  expanded: boolean
  onPress: () => void
  onOpenActivity: () => void
  anchorRef?: React.Ref<HTMLDivElement>
}

export const OrbDock = forwardRef<HTMLButtonElement, OrbDockProps>(function OrbDock(
  { state, label, largeTarget, expanded, onPress, onOpenActivity, anchorRef, ...rest },
  ref,
) {
  const { copy } = usePrototype()
  const pillLabel =
    label ??
    (state !== "idle"
      ? copy.orb.label[state as Exclude<PresenceOrbState, "idle">]
      : undefined)

  return (
    <div
      ref={anchorRef}
      data-slot="agentic-orb-dock"
      data-state={state}
      data-figma="OrbDock/root"
      className="z-30 inline-flex items-center gap-2"
    >
      {state !== "idle" && pillLabel ? (
        <button
          type="button"
          onClick={onOpenActivity}
          data-figma="OrbDock/label"
          className="h-8 rounded-full border border-border bg-background px-3 shadow-sm focus-ring"
        >
          <span className="text-caption font-medium text-foreground">{pillLabel}</span>
        </button>
      ) : null}
      <button
        ref={ref}
        type="button"
        aria-label={copy.orb.aria(state)}
        aria-expanded={expanded}
        onClick={onPress}
        data-figma="OrbDock/trigger"
        className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full focus-ring"
        {...rest}
      >
        <PresenceOrb state={state} size="dock" largeTarget={largeTarget} />
      </button>
    </div>
  )
})

"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { useAgenticMotion } from "../prototype-context"
import { tw } from "../lib"
import type { LevelSource } from "./use-audio-levels"

export type AmbientGlowProps = {
  scope: "viewport" | "container"
  state: "off" | "idle" | "listening" | "output" | "working"
  enabled: boolean
  source: LevelSource | null
  spread: "desktop" | "mobile"
  level?: number
  reduced?: boolean
}

function screenRadius(el: HTMLElement): number {
  let node = el.parentElement
  while (node && node !== document.body) {
    const radius = parseFloat(getComputedStyle(node).borderTopLeftRadius)
    if (radius > 0) return radius
    node = node.parentElement
  }
  return 0
}

export function AmbientGlow({ scope, state, enabled, reduced: reducedProp = false, level }: AmbientGlowProps): React.JSX.Element | null {
  const { reduced: motionReduced } = useAgenticMotion()
  const reduced = reducedProp || motionReduced
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [radius, setRadius] = useState(0)
  const voice = enabled && state !== "off"

  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el || !voice) return
    const read = () => setRadius(screenRadius(el))
    read()
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [voice])

  if (!voice) return null

  const curve = Math.max(0, radius - 1)
  const glowLevel = typeof level === "number" && !Number.isNaN(level) ? Math.min(1, Math.max(0, level)) : null

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      data-slot="agentic-ambient-glow"
      data-state={state}
      data-figma="AmbientGlow/root"
      className={tw("pointer-events-none z-30", scope === "viewport" ? "fixed inset-0" : "absolute inset-0")}
    >
      <div
        data-figma="AmbientGlow/ring"
        data-state={state}
        data-level={glowLevel === null ? undefined : glowLevel.toFixed(2)}
        data-reduced={reduced ? "" : undefined}
        className="timbl-glow-ring absolute p-0.5"
        style={{
          inset: 1,
          borderRadius: curve,
          ...(glowLevel === null ? {} : { ["--glow-level" as string]: String(glowLevel) }),
          mask: "linear-gradient(var(--foreground) 0 0) content-box, linear-gradient(var(--foreground) 0 0)",
          WebkitMask: "linear-gradient(var(--foreground) 0 0) content-box, linear-gradient(var(--foreground) 0 0)",
          maskComposite: "exclude",
          WebkitMaskComposite: "xor",
        }}
      />
    </div>
  )
}

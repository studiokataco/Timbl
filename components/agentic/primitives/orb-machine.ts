import type { Copy } from "../copy"
import type { EngineState, MicState, PresenceOrbState, Run, TalkState } from "../types"

export function deriveOrbState(input: {
  forced: PresenceOrbState | null
  mic: MicState | TalkState | null
  run: Run | null
  pendingRequests: number
  lastEventKind: EngineState["lastEventKind"]
}): PresenceOrbState {
  const { forced, mic, run, pendingRequests } = input
  if (forced) return forced
  if (mic === "listening" || mic === "requesting") return "listening"
  if (run?.status === "running") return "working"
  if (run?.status === "error") return "error"
  if (pendingRequests > 0 || run?.status === "needs_you") return "needs_you"
  if (run?.status === "done") return "done"
  return "idle"
}

export const ORB_LABEL_KEY: Record<PresenceOrbState, keyof Copy["orb"]["label"] | null> = {
  idle: null,
  listening: "listening",
  working: "working",
  needs_you: "needs_you",
  done: "done",
  error: "error",
}

export type OrbTransition = {
  halo: "in" | "out" | null
  arc: "sweep" | "out" | null
  pop: boolean
  check: boolean
  badge: "in" | "swap" | "out" | null
  label: "in" | "out" | null
}

const HAS_BADGE: Record<PresenceOrbState, boolean> = {
  idle: false,
  listening: false,
  working: false,
  needs_you: true,
  done: true,
  error: true,
}

export function orbTransition(prev: PresenceOrbState, next: PresenceOrbState): OrbTransition | null {
  if (prev === next) return null
  const badgeBefore = HAS_BADGE[prev]
  const badgeAfter = HAS_BADGE[next]
  const labelBefore = ORB_LABEL_KEY[prev] !== null
  const labelAfter = ORB_LABEL_KEY[next] !== null
  return {
    halo: next === "listening" ? "in" : prev === "listening" ? "out" : null,
    arc: next === "working" ? "sweep" : prev === "working" ? "out" : null,
    pop: next !== "idle",
    check: next === "done",
    badge: badgeAfter ? (badgeBefore ? "swap" : "in") : badgeBefore ? "out" : null,
    label: labelAfter && !labelBefore ? "in" : !labelAfter && labelBefore ? "out" : null,
  }
}

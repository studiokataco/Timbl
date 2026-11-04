"use client"

import { useEffect, useMemo, useRef } from "react"
import { VOICE_SCRIPTS } from "../defaults"
import { FIXTURE_NOW_MS } from "../clock"
import { outputEnvelope } from "./output-envelope"
import type { AmbientSignal, AudioSource } from "../types"

export type LevelSource = { kind: "mic" | "output" | "scripted"; read: () => number }

export function useAudioLevels(input: {
  source: AmbientSignal["source"]
  outputId: string | null
  outputChars: number
  scriptedLevels?: { atMs: number; level: number }[]
  audio: AudioSource
  reduced: boolean
}): LevelSource | null {
  const { source, outputId, outputChars, scriptedLevels, audio, reduced } = input
  const startRef = useRef<number>(FIXTURE_NOW_MS)
  const elapsedRef = useRef<number>(0)

  useEffect(() => {
    if (reduced || !source) return
    let raf = 0
    let prev = performance.now()
    elapsedRef.current = 0
    const step = (now: number) => {
      const dt = Math.min(100, Math.max(0, now - prev))
      prev = now
      elapsedRef.current += dt
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [source, outputId, reduced])

  return useMemo<LevelSource | null>(() => {
    if (reduced || !source) return null
    if (source === "output") {
      const env = outputEnvelope(outputId ?? "timbl-out", outputChars || 48)
      return {
        kind: "output",
        read: () => env(elapsedRef.current),
      }
    }
    const levels = scriptedLevels ?? VOICE_SCRIPTS.reschedule.levels
    const kind = source === "mic" && audio === "mic" ? "mic" : "scripted"
    void startRef.current
    return {
      kind,
      read: () => {
        if (levels.length === 0) return 0.35
        const cycle = levels[levels.length - 1]?.atMs ?? 1200
        const t = elapsedRef.current % Math.max(240, cycle)
        let current = levels[0]?.level ?? 0.3
        for (const item of levels) {
          if (item.atMs <= t) current = item.level
          else break
        }
        return current
      },
    }
  }, [reduced, source, outputId, outputChars, scriptedLevels, audio])
}

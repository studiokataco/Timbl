"use client"

import { useEffect, useMemo, useRef } from "react"
import { outputEnvelope } from "./output-envelope"
import type { AmbientSignal } from "../types"

export type LevelSource = { kind: "mic" | "output"; read: () => number }

export function useAudioLevels(input: {
  source: AmbientSignal["source"]
  outputId: string | null
  outputChars: number
  micLevel: number
  reduced: boolean
}): LevelSource | null {
  const { source, outputId, outputChars, micLevel, reduced } = input
  const elapsedRef = useRef(0)
  const micRef = useRef(micLevel)

  useEffect(() => {
    micRef.current = micLevel
  }, [micLevel])

  useEffect(() => {
    if (reduced || source !== "output") return
    let raf = 0
    let prev = performance.now()
    elapsedRef.current = 0
    const step = (now: number) => {
      elapsedRef.current += Math.min(100, Math.max(0, now - prev))
      prev = now
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [source, outputId, reduced])

  return useMemo<LevelSource | null>(() => {
    if (reduced || !source) return null
    if (source === "output") {
      const env = outputEnvelope(outputId ?? "output", outputChars || 48)
      return { kind: "output", read: () => env(elapsedRef.current) }
    }
    return { kind: "mic", read: () => micRef.current }
  }, [reduced, source, outputId, outputChars])
}

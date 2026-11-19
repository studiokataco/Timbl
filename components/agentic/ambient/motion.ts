export const MESH = {
  periodsSec: [64, 78, 90] as const,
  amplitudeXRatio: 0.03,
  amplitudeYRatio: 0.02,
} as const

export function meshAmplitude(containerPx: number): { x: number; y: number } {
  const safe = Math.max(240, containerPx)
  return {
    x: Math.round(safe * MESH.amplitudeXRatio),
    y: Math.round(safe * MESH.amplitudeYRatio),
  }
}

export const VOICE_NUDGE = { duration: 1.6, repeatDelay: 2.8, opacity: [0, 0.7, 0], scale: [1, 1.35, 1.55] } as const

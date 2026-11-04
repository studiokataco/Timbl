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

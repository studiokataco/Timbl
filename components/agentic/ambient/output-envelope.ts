export function envelopeDurationMs(chars: number): number {
  return Math.min(Math.max(1, chars) * 55, 6000)
}

function hashSeed(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function outputEnvelope(seedId: string, chars: number): (tMs: number) => number {
  const duration = envelopeDurationMs(chars)
  const seed = hashSeed(seedId || "timbl")
  const phaseA = ((seed & 1023) / 1024) * Math.PI * 2
  const phaseB = (((seed >>> 10) & 1023) / 1024) * Math.PI * 2

  return (tMs: number): number => {
    if (tMs < 0 || tMs >= duration) return 0
    const sec = tMs / 1000
    const phraseMod = tMs % 1800
    if (phraseMod > 1520) return 0.06
    const syll = 0.5 + 0.5 * Math.sin(sec * Math.PI * 2 * 4.5 + phaseA)
    const contour = 0.65 + 0.35 * Math.cos(sec * Math.PI * 2 * 1.3 + phaseB)
    const fadeOut = duration - tMs < 240 ? (duration - tMs) / 240 : 1
    return Math.min(1, Math.max(0.08, syll * contour * fadeOut))
  }
}

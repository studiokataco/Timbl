export type RateTier = "free" | "agency" | "operator"

interface Bucket {
  minuteTokens: number
  dayTokens: number
  minuteReset: number
  dayReset: number
}

const LIMITS: Record<RateTier, { rpm: number; rpd: number }> = {
  free: { rpm: 300, rpd: 10000 },
  agency: { rpm: 1200, rpd: 100000 },
  operator: { rpm: Infinity, rpd: Infinity },
}

const buckets = new Map<string, Bucket>()

export function checkRateLimit(
  appId: string,
  tier: RateTier,
): { allowed: boolean; retryAfter?: number } {
  if (tier === "operator") return { allowed: true }

  const limits = LIMITS[tier]
  const now = Date.now()

  let b = buckets.get(appId)
  if (!b) {
    b = {
      minuteTokens: limits.rpm,
      dayTokens: limits.rpd,
      minuteReset: now + 60_000,
      dayReset: now + 86_400_000,
    }
    buckets.set(appId, b)
  }

  if (now > b.minuteReset) {
    b.minuteTokens = limits.rpm
    b.minuteReset = now + 60_000
  }
  if (now > b.dayReset) {
    b.dayTokens = limits.rpd
    b.dayReset = now + 86_400_000
  }

  if (b.minuteTokens <= 0) {
    return { allowed: false, retryAfter: Math.ceil((b.minuteReset - now) / 1000) }
  }
  if (b.dayTokens <= 0) {
    return { allowed: false, retryAfter: Math.ceil((b.dayReset - now) / 1000) }
  }

  b.minuteTokens--
  b.dayTokens--
  return { allowed: true }
}

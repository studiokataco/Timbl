const MINUTES_PER_DAY = 480

export function parseTimeEstimate(input: string): number | null {
  const s = input.trim()
  if (!s) return null

  let total = 0
  let matched = false

  const dayMatch = s.match(/(\d+(?:\.\d+)?)\s*d/i)
  if (dayMatch) {
    total += parseFloat(dayMatch[1]) * MINUTES_PER_DAY
    matched = true
  }

  const hourMatch = s.match(/(\d+(?:\.\d+)?)\s*h/i)
  if (hourMatch) {
    total += parseFloat(hourMatch[1]) * 60
    matched = true
  }

  const minMatch = s.match(/(\d+(?:\.\d+)?)\s*m(?!s)/i)
  if (minMatch) {
    total += parseFloat(minMatch[1])
    matched = true
  }

  if (!matched) {
    const plain = s.match(/^(\d+)$/)
    if (plain) return parseInt(plain[1], 10)
    return null
  }

  return total > 0 ? Math.round(total) : null
}

export function formatTimeEstimate(minutes: number): string {
  if (minutes <= 0) return "0m"

  if (minutes % MINUTES_PER_DAY === 0) {
    return `${minutes / MINUTES_PER_DAY}d`
  }

  const days = Math.floor(minutes / MINUTES_PER_DAY)
  const remaining = minutes % MINUTES_PER_DAY
  const hours = Math.floor(remaining / 60)
  const mins = remaining % 60

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (mins > 0) parts.push(`${mins}m`)

  return parts.join(" ")
}

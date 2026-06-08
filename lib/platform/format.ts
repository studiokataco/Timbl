/* Display formatters for the control centre. Pure - safe in server and
 * client components. */

export function usd(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  if (n >= 1) return `$${n.toFixed(2)}`
  if (n === 0) return "$0"
  return `$${n.toFixed(4)}`
}

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return `${Math.round(n)}`
}

export function pct(n: number): string {
  return `${(n * 100).toFixed(n >= 0.1 ? 0 : 1)}%`
}

export function duration(ms: number | null): string {
  if (ms === null) return "-"
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60_000).toFixed(1)}m`
}

export function relativeTime(iso: string | null): string {
  if (!iso) return "never"
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return "-"
  const diff = Date.now() - then
  const sec = Math.round(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.round(hr / 24)}d ago`
}

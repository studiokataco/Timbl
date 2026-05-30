/*
 * Calendar event colour helper. Categories supply a vivid hex colour for
 * their dot indicator; the calendar grid wants a pastel/desaturated version
 * for the event-pill background so titles stay legible. We do a simple
 * RGB-blend with white at 80%, which is close enough to the shadcnuikit
 * aesthetic without pulling in a colour library.
 *
 * Pastel backgrounds stay light in dark mode - pill text must always use
 * dark ink, never var(--color-foreground).
 */
export const PASTEL_PILL_TEXT = "#181d26"

export function lightenForBg(hex: string | null | undefined, amount = 0.8): string {
  if (!hex) return "var(--color-secondary)"
  const m = hex.replace("#", "")
  if (m.length !== 6) return "var(--color-secondary)"
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  const blend = (c: number) => Math.round(c + (255 - c) * amount)
  const rr = blend(r).toString(16).padStart(2, "0")
  const gg = blend(g).toString(16).padStart(2, "0")
  const bb = blend(b).toString(16).padStart(2, "0")
  return `#${rr}${gg}${bb}`
}

export function categoryPillColors(hex: string | null | undefined) {
  return {
    backgroundColor: lightenForBg(hex),
    color: PASTEL_PILL_TEXT,
  }
}

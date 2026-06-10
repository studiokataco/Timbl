import { cn } from "@/lib/utils"

/*
 * Compact per-metric meter. Presentational only - safe to drop into any
 * server or client surface that already has { used, limit }. Tone follows
 * the DESIGN.md semantic tokens: ink fill while comfortable, warning amber
 * from 80%, destructive red at/over the limit. Unlimited metrics render a
 * soft emerald track instead of a fill ratio.
 */

export type UsageMeterTone = "ok" | "near" | "over" | "unlimited"

export function usageMeterTone(used: number, limit: number | null): UsageMeterTone {
  if (limit === null) return "unlimited"
  if (limit <= 0) return used > 0 ? "over" : "ok"
  const ratio = used / limit
  if (ratio >= 1) return "over"
  if (ratio >= 0.8) return "near"
  return "ok"
}

const FILL_TONE: Record<UsageMeterTone, string> = {
  ok: "bg-foreground",
  near: "bg-warning",
  over: "bg-destructive",
  unlimited: "bg-badge-emerald/40",
}

export function UsageMeter({
  label,
  used,
  limit,
  hint,
  className,
}: {
  label: string
  used: number
  limit: number | null
  hint?: string
  className?: string
}) {
  const tone = usageMeterTone(used, limit)
  const pct =
    tone === "unlimited"
      ? 100
      : limit && limit > 0
        ? Math.min(100, Math.max(used > 0 ? 2 : 0, (used / limit) * 100))
        : used > 0
          ? 100
          : 0

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium text-foreground">{label}</span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {used.toLocaleString("en-IN")}
          {limit !== null ? ` / ${limit.toLocaleString("en-IN")}` : " - no limit"}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit ?? undefined}
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary"
      >
        <div
          className={cn("h-full rounded-full transition-[width]", FILL_TONE[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
      {hint ? (
        <p className="mt-1 text-xs leading-snug text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

import { Minus, TrendingDown, TrendingUp } from "lucide-react"

import { cn } from "@/lib/utils"

/* Efferd-style KPI card: muted label + outline trend badge in the header, a
 * large tabular value, and a two-line footer (a lead line with a directional
 * icon, then a muted hint). Server-safe - pure presentation. */

type Trend = "up" | "down" | "flat"

function trendFrom(value: number): Trend {
  if (value > 0) return "up"
  if (value < 0) return "down"
  return "flat"
}

function signedPct(fraction: number): string {
  const v = Math.round(fraction * 100)
  return `${v > 0 ? "+" : ""}${v}%`
}

const TREND_ICON = { up: TrendingUp, down: TrendingDown, flat: Minus }
const TREND_TONE = {
  up: "text-emerald-600 dark:text-emerald-400",
  down: "text-red-600 dark:text-red-400",
  flat: "text-muted-foreground",
}

export function TrendBadge({ deltaPct }: { deltaPct: number }) {
  const trend = trendFrom(deltaPct)
  const Icon = TREND_ICON[trend]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-medium tabular-nums",
        TREND_TONE[trend],
      )}
    >
      <Icon className="size-3.5" />
      {signedPct(deltaPct)}
    </span>
  )
}

export function MetricCard({
  label,
  value,
  deltaPct,
  foot,
  footHint,
  tone,
}: {
  label: string
  value: string
  /* signed fraction (0.12 -> +12%). Omit when there is no honest prior. */
  deltaPct?: number | null
  foot: string
  footHint: string
  /* overrides the footer lead colour + icon when there is no delta to imply it */
  tone?: Trend
}) {
  const hasDelta = typeof deltaPct === "number" && Number.isFinite(deltaPct)
  const footTrend: Trend | null = hasDelta ? trendFrom(deltaPct) : tone ?? null
  const FootIcon = footTrend ? TREND_ICON[footTrend] : null
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-gradient-to-t from-foreground/[0.02] to-card p-5 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        {hasDelta ? <TrendBadge deltaPct={deltaPct} /> : null}
      </div>
      <div className="font-heading text-3xl font-semibold tracking-tight tabular-nums">
        {value}
      </div>
      <div className="flex flex-col gap-0.5 text-sm">
        <span className="flex items-center gap-1.5 font-medium">
          {foot}
          {FootIcon ? (
            <FootIcon className={cn("size-4", footTrend && TREND_TONE[footTrend])} />
          ) : null}
        </span>
        <span className="text-muted-foreground">{footHint}</span>
      </div>
    </div>
  )
}

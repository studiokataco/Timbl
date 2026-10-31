import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { pct, usd } from "@/lib/platform/format"

/* Server-safe presentational widgets shared across control pages. */

export function StatStrip({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "grid gap-px overflow-hidden rounded-xl bg-foreground/10 ring-1 ring-foreground/10",
        className,
      )}
    >
      {children}
    </div>
  )
}

export function StatItem({
  label,
  value,
  sub,
  tone,
  className,
}: {
  label: string
  value: string
  sub?: string
  tone?: "positive" | "negative"
  className?: string
}) {
  return (
    <div className={cn("bg-card px-4 py-3.5", className)}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1.5 font-heading text-2xl font-semibold tracking-tight tabular-nums",
          tone === "negative" && "text-red-600 dark:text-red-400",
          tone === "positive" && "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {value}
      </div>
      {sub ? <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  )
}

const AVATAR_TONES = [
  "bg-orange-400/20 text-orange-700 dark:text-orange-400",
  "bg-pink-400/20 text-pink-700 dark:text-pink-400",
  "bg-violet-400/20 text-violet-700 dark:text-violet-400",
  "bg-emerald-400/20 text-emerald-700 dark:text-emerald-400",
]

export function OrgAvatar({
  name,
  seed,
  size = "md",
}: {
  name: string
  seed: string
  size?: "md" | "lg"
}) {
  let hash = 0
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  const tone = AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length]
  const initials =
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        size === "lg" ? "size-12 text-base" : "size-8 text-xs",
        tone,
      )}
    >
      {initials}
    </span>
  )
}

const TIER_DOT: Record<string, string> = {
  free: "bg-muted-foreground/50",
  trial: "bg-emerald-500",
  studio: "bg-blue-500",
  agency: "bg-violet-500",
  scale: "bg-amber-500",
}

export function TierPill({ tier }: { tier: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize">
      <span className={cn("size-1.5 rounded-full", TIER_DOT[tier] ?? "bg-muted-foreground/50")} />
      {tier}
    </span>
  )
}

export function HealthBadge({ rate }: { rate: number }) {
  const dot =
    rate > 0.1 ? "bg-red-500" : rate > 0.02 ? "bg-amber-500" : "bg-emerald-500"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 tabular-nums",
        rate > 0.1 ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
      )}
    >
      <span className={cn("size-1.5 rounded-full", dot)} />
      {pct(rate)}
    </span>
  )
}

export function Panel({
  title,
  sub,
  children,
  className,
  bodyClassName,
}: {
  title?: string
  sub?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn("rounded-xl bg-card ring-1 ring-foreground/10", className)}>
      {title ? (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/5 px-4 py-3">
          <h2 className="font-heading text-sm font-semibold tracking-tight">{title}</h2>
          {sub ? <span className="text-xs text-muted-foreground">{sub}</span> : null}
        </header>
      ) : null}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  )
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  delta,
}: {
  label: string
  value: string
  sub?: string
  icon?: LucideIcon
  /* e.g. "+12%" (green) or "-4%" (red); leading sign drives the colour. */
  delta?: string
}) {
  const deltaTone = delta?.startsWith("-")
    ? "text-red-600 dark:text-red-400"
    : "text-emerald-600 dark:text-emerald-400"
  return (
    <div className="rounded-xl bg-card px-4 py-3.5 ring-1 ring-foreground/10">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        {Icon ? (
          <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <div className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </div>
        {delta ? (
          <span className={cn("text-xs font-medium tabular-nums", deltaTone)}>{delta}</span>
        ) : null}
      </div>
      {sub ? <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  )
}

/* Horizontal bars for a USD-valued map (cost by model / provider). */
export function CostBars({
  data,
  names,
  empty = "No data yet",
}: {
  data: Record<string, number>
  names?: Record<string, string>
  empty?: string
}) {
  const entries = Object.entries(data)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>
  }
  const max = Math.max(...entries.map(([, v]) => v))
  return (
    <div className="flex flex-col gap-2">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center gap-3 text-sm">
          <div className="w-40 shrink-0 truncate text-muted-foreground" title={names?.[key] ?? key}>
            {names?.[key] ?? key}
          </div>
          <div className="relative h-5 flex-1 overflow-hidden rounded bg-muted">
            <div
              className="h-full rounded bg-foreground/80"
              style={{ width: `${Math.max(4, (value / max) * 100)}%` }}
            />
          </div>
          <div className="w-16 shrink-0 text-right tabular-nums">{usd(value)}</div>
        </div>
      ))}
    </div>
  )
}

export function StatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    succeeded: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    failed: "bg-red-500/15 text-red-700 dark:text-red-400",
    in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    queued: "bg-amber-500/15 text-amber-700 dark:text-amber-500",
    awaiting_human: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
    cancelled: "bg-muted text-muted-foreground",
    active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    suspended: "bg-red-500/15 text-red-700 dark:text-red-400",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tone[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  )
}

export function PageHeading({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="mb-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}

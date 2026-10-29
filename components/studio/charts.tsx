"use client"

import { useMemo, useState, type KeyboardEvent, type PointerEvent } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ChevronDown } from "lucide-react"
import { format, startOfDay, subDays } from "date-fns"

import type { AgentRunDoc } from "@/lib/schemas/agentRun"
import { compact } from "@/lib/platform/format"
import { SegmentedTabs } from "@/components/ui/segmented-tabs"
import { MiniRing, StatCell } from "@/components/shared/stat-grid"
import { cn } from "@/lib/utils"

const EASE = [0.22, 1, 0.36, 1] as const
const DAY_MS = 86_400_000

type Bucket = { date: Date; ok: number; failed: number; active: number; cancelled: number; total: number }

function bucketize(runs: AgentRunDoc[], days: number, endOffset = 0): Bucket[] {
  const today = startOfDay(new Date())
  const out: Bucket[] = Array.from({ length: days }, (_, i) => ({
    date: subDays(today, days - 1 - i + endOffset),
    ok: 0,
    failed: 0,
    active: 0,
    cancelled: 0,
    total: 0,
  }))
  const first = out[0].date.getTime()
  for (const r of runs) {
    const t = Date.parse(r.startedAt ?? r.createdAt ?? "")
    if (Number.isNaN(t)) continue
    const idx = Math.floor((startOfDay(new Date(t)).getTime() - first) / DAY_MS)
    const b = out[idx]
    if (!b) continue
    if (r.status === "succeeded") b.ok++
    else if (r.status === "failed") b.failed++
    else if (r.status === "cancelled") b.cancelled++
    else b.active++
    b.total++
  }
  return out
}

function outcomes(runs: AgentRunDoc[], days: number) {
  const buckets = bucketize(runs, days)
  return {
    ok: buckets.reduce((s, b) => s + b.ok, 0),
    failed: buckets.reduce((s, b) => s + b.failed, 0),
  }
}

function dayLabel(d: Date): string {
  const today = startOfDay(new Date()).getTime()
  if (d.getTime() === today) return "Today"
  if (d.getTime() === today - DAY_MS) return "Yesterday"
  return format(d, "EEE d MMM")
}

const SERIES = [
  { key: "ok", label: "Finished", swatch: "bg-foreground/60" },
  { key: "failed", label: "Failed", swatch: "bg-rose-500" },
  { key: "active", label: "In progress", swatch: "bg-orange-400" },
  { key: "cancelled", label: "Cancelled", swatch: "bg-muted-foreground/35" },
] as const

function RunsChart({ runs, complete }: { runs: AgentRunDoc[]; complete: boolean }) {
  const [period, setPeriod] = useState("14")
  const [hover, setHover] = useState<number | null>(null)
  const reduced = useReducedMotion()
  const days = Number(period)

  const buckets = useMemo(() => bucketize(runs, days), [runs, days])
  const prior = useMemo(() => bucketize(runs, days, days), [runs, days])
  const max = Math.max(1, ...buckets.map((b) => b.total))
  const total = buckets.reduce((s, b) => s + b.total, 0)
  const priorTotal = prior.reduce((s, b) => s + b.total, 0)

  const oldest = runs.reduce((m, r) => Math.min(m, Date.parse(r.startedAt ?? "") || m), Infinity)
  const covers = complete || oldest <= prior[0].date.getTime()
  const delta = covers && priorTotal > 0 ? (total - priorTotal) / priorTotal : null

  const sums = SERIES.map((s) => ({ ...s, value: buckets.reduce((acc, b) => acc + b[s.key], 0) }))
  const focus = hover != null ? buckets[hover] : null

  function pick(e: PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const i = Math.floor(((e.clientX - rect.left) / rect.width) * days)
    setHover(Math.max(0, Math.min(days - 1, i)))
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault()
      const step = e.key === "ArrowLeft" ? -1 : 1
      setHover((h) => Math.max(0, Math.min(days - 1, (h ?? days) + step)))
    }
    if (e.key === "Escape") setHover(null)
  }

  return (
    <section aria-label="Agent runs trend" className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] text-muted-foreground">
            {focus ? dayLabel(focus.date) : `Agent runs, last ${days} days`}
          </p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="text-[28px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
              {(focus ? focus.total : total).toLocaleString()}
            </span>
            {focus ? (
              <span className="text-[13px] text-muted-foreground">
                {focus.total === 1 ? "run" : "runs"}
                {focus.failed > 0 && <span className="text-rose-600 dark:text-rose-400"> · {focus.failed} failed</span>}
              </span>
            ) : (
              delta != null && (
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[12px] font-medium tabular-nums",
                    delta >= 0
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "bg-secondary text-muted-foreground",
                  )}
                >
                  {delta >= 0 ? "+" : ""}
                  {Math.round(delta * 100)}% vs previous {days} days
                </span>
              )
            )}
          </p>
        </div>
        <SegmentedTabs
          tabs={[
            { id: "7", label: "7d" },
            { id: "14", label: "14d" },
            { id: "30", label: "30d" },
          ]}
          value={period}
          onChange={(v) => {
            setPeriod(v)
            setHover(null)
          }}
          className="shrink-0"
        />
      </div>

      <div className="relative mt-5">
        <span className="pointer-events-none absolute -top-1 right-0 text-[11px] tabular-nums text-muted-foreground">
          {max}
        </span>
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border" />
        <div
          role="img"
          tabIndex={0}
          aria-label={`${total} runs in the last ${days} days. Use arrow keys to inspect each day.`}
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={() => setHover(null)}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
          className="flex h-36 touch-pan-y items-end gap-[3px] rounded-sm pt-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-1"
        >
          {buckets.map((b, i) => {
            const dim = hover != null && hover !== i
            return (
              <div key={`${period}-${i}`} className="flex h-full min-w-0 flex-1 items-end justify-center">
                {b.total === 0 ? (
                  <span className={cn("h-0.5 w-full max-w-6 rounded-full bg-border transition-opacity duration-150", dim && "opacity-40")} />
                ) : (
                  <motion.div
                    initial={reduced ? false : { scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.45, ease: EASE, delay: reduced ? 0 : i * (0.25 / days) }}
                    style={{ height: `${(b.total / max) * 100}%` }}
                    className={cn(
                      "flex w-full max-w-6 origin-bottom flex-col-reverse overflow-hidden rounded-t-[3px] transition-opacity duration-150",
                      dim && "opacity-35",
                    )}
                  >
                    {SERIES.map((s) =>
                      b[s.key] > 0 ? (
                        <span key={s.key} className={s.swatch} style={{ height: `${(b[s.key] / b.total) * 100}%` }} />
                      ) : null,
                    )}
                  </motion.div>
                )}
              </div>
            )
          })}
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
          <span>{format(buckets[0].date, "d MMM")}</span>
          <span>{format(buckets[Math.floor(days / 2)].date, "d MMM")}</span>
          <span>Today</span>
        </div>
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border pt-3 text-[12px]">
        {sums
          .filter((s) => s.key === "ok" || s.value > 0)
          .map((s) => {
            const value = focus ? focus[s.key] : s.value
            return (
              <li key={s.key} className="flex items-center gap-1.5 text-muted-foreground">
                <span aria-hidden className={cn("size-2 rounded-[2px]", s.swatch)} />
                {s.label}
                <span className="font-medium tabular-nums text-foreground">{value}</span>
              </li>
            )
          })}
      </ul>
    </section>
  )
}

type Health = "none" | "ok" | "warn" | "fail"

const HEALTH_TONE: Record<Health, string> = {
  none: "bg-foreground/10",
  ok: "bg-emerald-500/85",
  warn: "bg-orange-400",
  fail: "bg-rose-500",
}

function healthOf(b: Bucket): Health {
  if (b.total === 0) return "none"
  if (b.failed > 0) return "fail"
  if (b.active > 0 || b.cancelled > 0) return "warn"
  return "ok"
}

export function HealthStrip({ runs, days = 14 }: { runs: AgentRunDoc[]; days?: number }) {
  const buckets = useMemo(() => bucketize(runs, days), [runs, days])
  const failedDays = buckets.filter((b) => b.failed > 0).length
  return (
    <span
      role="img"
      aria-label={`Last ${days} days: ${buckets.filter((b) => b.total > 0).length} active days, ${failedDays} with failures`}
      className="flex h-4 items-stretch gap-[2px]"
    >
      {buckets.map((b, i) => (
        <span key={i} className={cn("w-[5px] rounded-[1.5px]", HEALTH_TONE[healthOf(b)])} />
      ))}
    </span>
  )
}

export function HealthCard({ runs, days = 30 }: { runs: AgentRunDoc[]; days?: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const reduced = useReducedMotion()
  const buckets = useMemo(() => bucketize(runs, days), [runs, days])
  const ok = buckets.reduce((s, b) => s + b.ok, 0)
  const failed = buckets.reduce((s, b) => s + b.failed, 0)
  const total = buckets.reduce((s, b) => s + b.total, 0)
  const rate = ok + failed > 0 ? ok / (ok + failed) : null
  const focus = hover != null ? buckets[hover] : null

  function pick(e: PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const i = Math.floor(((e.clientX - rect.left) / rect.width) * days)
    setHover(Math.max(0, Math.min(days - 1, i)))
  }

  return (
    <section aria-label={`Last ${days} days`} className="rounded-xl border border-border p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[14px] font-semibold text-foreground">Last {days} days</p>
        <p className="text-[13px] tabular-nums text-muted-foreground">
          {rate == null ? "No finished runs" : (
            <>
              <span className="font-medium text-foreground">{Math.round(rate * 100)}%</span> success · {total} runs
            </>
          )}
        </p>
      </div>
      <div
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => setHover(null)}
        className="mt-4 flex h-9 touch-pan-y items-stretch gap-[3px]"
      >
        {buckets.map((b, i) => (
          <motion.span
            key={i}
            initial={reduced ? false : { opacity: 0, scaleY: 0.4 }}
            animate={{ opacity: hover != null && hover !== i ? 0.45 : 1, scaleY: hover === i ? 1.12 : 1 }}
            transition={{ duration: 0.2, ease: EASE, delay: reduced || hover != null ? 0 : i * 0.008 }}
            className={cn("flex-1 rounded-[3px]", HEALTH_TONE[healthOf(b)])}
          />
        ))}
      </div>
      <p className="mt-2.5 min-h-[18px] text-[12px] text-muted-foreground" aria-live="polite">
        {focus ? (
          <>
            <span className="font-medium text-foreground">{dayLabel(focus.date)}</span>
            {" · "}
            {focus.total === 0
              ? "No runs"
              : `${focus.total} ${focus.total === 1 ? "run" : "runs"}${focus.failed ? `, ${focus.failed} failed` : ""}`}
          </>
        ) : (
          <span className="flex items-center gap-3">
            <Legend tone="ok" label="All finished" />
            <Legend tone="fail" label="Had a failure" />
            <Legend tone="none" label="No runs" />
          </span>
        )}
      </p>
    </section>
  )
}

function Legend({ tone, label }: { tone: Health; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn("size-2 rounded-[2px]", HEALTH_TONE[tone])} />
      {label}
    </span>
  )
}

function MiniBars({ buckets }: { buckets: Bucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.total))
  return (
    <span aria-hidden className="flex h-6 w-[60px] shrink-0 items-end gap-[2px]">
      {buckets.map((b, i) => (
        <span
          key={i}
          className={cn(
            "flex-1 rounded-[1.5px]",
            b.total === 0 ? "h-px bg-border" : b.failed > 0 ? "bg-rose-500/80" : "bg-foreground/70",
          )}
          style={b.total ? { height: `${Math.max(12, (b.total / max) * 100)}%` } : undefined}
        />
      ))}
    </span>
  )
}

type StripProps = {
  runs: AgentRunDoc[]
  complete: boolean
  runsUsed: number
  runsQuota: number | null
  activeCount: number
  agentCap: number
  trendOpen: boolean
  onTrend: (open: boolean) => void
}

export function StatsStrip({ runs, complete, runsUsed, runsQuota, activeCount, agentCap, trendOpen, onTrend }: StripProps) {
  const reduced = useReducedMotion()
  const recent = useMemo(() => bucketize(runs, 14), [runs])
  const prior = useMemo(() => bucketize(runs, 14, 14), [runs])
  const month = useMemo(() => outcomes(runs, 30), [runs])
  const total = recent.reduce((s, b) => s + b.total, 0)
  const priorTotal = prior.reduce((s, b) => s + b.total, 0)
  const oldest = runs.reduce((m, r) => Math.min(m, Date.parse(r.startedAt ?? "") || m), Infinity)
  const delta = (complete || oldest <= prior[0].date.getTime()) && priorTotal > 0 ? (total - priorTotal) / priorTotal : null
  const finished = month.ok + month.failed
  const rate = finished > 0 ? month.ok / finished : null

  return (
    <section aria-label="Overview" className="overflow-hidden rounded-xl border border-border">
      <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
        <StatCell
          label={<>Runs<span className="sm:hidden">, 14d</span><span className="hidden sm:inline"> · 14 days</span></>}
          value={total}
          sub={
            delta != null ? (
              <span className={delta >= 0 ? "text-emerald-700 dark:text-emerald-400" : undefined}>
                {delta >= 0 ? "+" : ""}
                {Math.round(delta * 100)}%
              </span>
            ) : undefined
          }
          visual={<MiniBars buckets={recent} />}
        />
        <StatCell
          label={<>Success<span className="sm:hidden">, 30d</span><span className="hidden sm:inline"> · 30 days</span></>}
          value={rate == null ? "-" : `${Math.round(rate * 100)}%`}
          sub={month.failed > 0 ? `${month.failed} failed` : undefined}
          visual={rate == null ? undefined : <MiniRing value={rate} tone="stroke-emerald-500" label={`${Math.round(rate * 100)} percent success`} />}
        />
        <StatCell
          label={<>Runs used<span className="hidden sm:inline"> this month</span></>}
          value={compact(runsUsed)}
          sub={runsQuota == null ? "no cap" : `of ${compact(runsQuota)}`}
          visual={runsQuota ? <MiniRing value={runsUsed / runsQuota} tone="stroke-foreground" label={`${runsUsed} of ${runsQuota} runs used`} /> : undefined}
        />
        <StatCell
          label="Agents on"
          value={activeCount}
          sub={`of ${agentCap}`}
          visual={<MiniRing value={agentCap ? activeCount / agentCap : 0} tone="stroke-badge-violet" label={`${activeCount} of ${agentCap} agents on`} />}
        />
      </div>

      <button
        type="button"
        aria-expanded={trendOpen}
        onClick={() => onTrend(!trendOpen)}
        className="flex w-full items-center justify-center gap-1.5 border-t border-border py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        {trendOpen ? "Hide trend" : "Show trend"}
        <ChevronDown aria-hidden className={cn("size-3.5 transition-transform duration-200 motion-reduce:transition-none", trendOpen && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {trendOpen && (
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, height: "auto" }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden border-t border-border"
          >
            <RunsChart runs={runs} complete={complete} />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

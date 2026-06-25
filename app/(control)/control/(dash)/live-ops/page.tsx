import {
  Activity,
  AlertTriangle,
  CircleDot,
  Clock,
  Loader2,
  Timer,
} from "lucide-react"

import { AutoRefresh } from "@/components/control/auto-refresh"
import { ThroughputChart } from "@/components/control/charts"
import { StatCard, StatusPill } from "@/components/control/widgets"
import { compact, duration, pct, relativeTime, usd } from "@/lib/platform/format"
import { getOpsData, listRealtimeHealth } from "@/lib/platform/queries"
import type { RunRow } from "@/lib/platform/queries"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

const STATUS_ORDER = [
  "in_progress",
  "queued",
  "awaiting_human",
  "succeeded",
  "failed",
  "cancelled",
] as const

const STATUS_DOT: Record<string, string> = {
  in_progress: "bg-blue-500",
  queued: "bg-amber-500",
  awaiting_human: "bg-violet-500",
  succeeded: "bg-emerald-500",
  failed: "bg-red-500",
  cancelled: "bg-muted-foreground",
}

export default async function LiveOpsPage() {
  const [ops, realtimeHealth] = await Promise.all([
    getOpsData(400),
    listRealtimeHealth(15),
  ])
  const inFlightCount = ops.inFlight.length
  const runs24 = ops.hourly.reduce((s, h) => s + h.runs, 0)
  const failed24 = ops.hourly.reduce((s, h) => s + h.failed, 0)
  const failRate24 = runs24 > 0 ? failed24 / runs24 : 0

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Live ops</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time agent activity across every tenant.
          </p>
        </div>
        <AutoRefresh intervalMs={10_000} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Loader2} label="In flight" value={`${inFlightCount}`} sub="queued + running" />
        <StatCard icon={Activity} label="Runs (24h)" value={compact(runs24)} sub={`${compact(failed24)} failed`} />
        <StatCard icon={AlertTriangle} label="Failure (24h)" value={pct(failRate24)} delta={failRate24 > 0.1 ? `${pct(failRate24)}` : undefined} />
        <StatCard icon={Timer} label="Latency p95" value={duration(ops.latency.p95)} sub={`p50 ${duration(ops.latency.p50)}`} />
      </div>

      {/* Health board */}
      <section className="mt-6">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {STATUS_ORDER.map((s) => (
            <div key={s} className="rounded-xl bg-card px-3 py-3 ring-1 ring-foreground/10">
              <div className="flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", STATUS_DOT[s])} />
                <span className="text-[11px] font-medium capitalize text-muted-foreground">
                  {s.replace(/_/g, " ")}
                </span>
              </div>
              <div className="mt-1 font-heading text-xl font-semibold tabular-nums">
                {ops.statusCounts[s] ?? 0}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 font-heading text-sm font-semibold tracking-tight">
          Realtime health (recent degrades)
        </h2>
        <div className="rounded-xl bg-card ring-1 ring-foreground/10">
          {realtimeHealth.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No degrade events recorded.
            </p>
          ) : (
            <ol className="divide-y divide-foreground/5">
              {realtimeHealth.map((row) => (
                <li
                  key={`${row.orgId}-${row.degradedAt}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                >
                  <span className="font-medium">{row.orgId}</span>
                  <span className="text-muted-foreground">{row.reason}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {relativeTime(row.degradedAt)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:col-span-2">
          <h2 className="mb-3 font-heading text-sm font-semibold tracking-tight">
            Throughput - last 24h
          </h2>
          <ThroughputChart data={ops.hourly} />
        </section>
        <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="mb-4 font-heading text-sm font-semibold tracking-tight">
            Latency
          </h2>
          <LatencyBars p50={ops.latency.p50} p95={ops.latency.p95} max={ops.latency.max} />
          <p className="mt-3 text-xs text-muted-foreground">
            {compact(ops.latency.count)} runs sampled · {usd(ops.totalUsd)} total
          </p>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-heading text-sm font-semibold tracking-tight">
            <CircleDot className="size-4 text-blue-500" /> In flight
          </h2>
          <div className="flex flex-col gap-2">
            {ops.inFlight.map((run) => (
              <InFlightCard key={run.id} run={run} />
            ))}
            {ops.inFlight.length === 0 ? (
              <p className="rounded-xl bg-card px-3 py-8 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
                Nothing running right now.
              </p>
            ) : null}
          </div>
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 font-heading text-sm font-semibold tracking-tight">
            <Clock className="size-4 text-muted-foreground" /> Activity stream
          </h2>
          <div className="rounded-xl bg-card p-2 ring-1 ring-foreground/10">
            <ol className="flex flex-col">
              {ops.recent.map((run) => (
                <ActivityRow key={run.id} run={run} />
              ))}
              {ops.recent.length === 0 ? (
                <li className="px-2 py-8 text-center text-sm text-muted-foreground">
                  No activity yet.
                </li>
              ) : null}
            </ol>
          </div>
        </section>
      </div>
    </div>
  )
}

function InFlightCard({ run }: { run: RunRow }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-card px-3 py-2.5 ring-1 ring-foreground/10">
      <div className="flex min-w-0 items-center gap-3">
        <span className="relative flex size-2.5 shrink-0">
          <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-75", STATUS_DOT[run.status])} />
          <span className={cn("relative inline-flex size-2.5 rounded-full", STATUS_DOT[run.status])} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {run.agentName}{" "}
            <span className="font-normal text-muted-foreground">· {run.orgId}</span>
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {run.model ?? "-"} · started {relativeTime(run.startedAt)}
          </div>
        </div>
      </div>
      <StatusPill status={run.status} />
    </div>
  )
}

function ActivityRow({ run }: { run: RunRow }) {
  return (
    <li className="flex items-center gap-3 border-b border-foreground/5 px-2 py-2 text-sm last:border-0">
      <span className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[run.status] ?? "bg-muted-foreground")} />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium">{run.agentName}</span>{" "}
        <span className="text-muted-foreground">· {run.orgId}</span>
      </span>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {duration(run.durationMs)}
      </span>
      <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
        {relativeTime(run.startedAt)}
      </span>
    </li>
  )
}

function LatencyBars({ p50, p95, max }: { p50: number; p95: number; max: number }) {
  const ceiling = Math.max(max, 1)
  const rows = [
    { label: "p50", value: p50, tone: "bg-emerald-500" },
    { label: "p95", value: p95, tone: "bg-amber-500" },
    { label: "max", value: max, tone: "bg-red-500" },
  ]
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3 text-sm">
          <span className="w-8 shrink-0 text-muted-foreground">{r.label}</span>
          <div className="relative h-5 flex-1 overflow-hidden rounded bg-muted">
            <div
              className={cn("h-full rounded", r.tone)}
              style={{ width: `${Math.max(3, (r.value / ceiling) * 100)}%` }}
            />
          </div>
          <span className="w-14 shrink-0 text-right tabular-nums">{duration(r.value)}</span>
        </div>
      ))}
    </div>
  )
}

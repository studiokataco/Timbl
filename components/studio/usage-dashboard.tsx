"use client"

import { useQuery } from "@tanstack/react-query"
import { Activity, Cpu, Gauge } from "lucide-react"

import { getStudioUsage, type StudioUsage } from "@/lib/actions/usage"
import { compact, pct } from "@/lib/platform/format"
import type { LucideIcon } from "lucide-react"

/*
 * Studio usage dashboard - the tenant-facing "where do my tokens and calls
 * go" view that replaces the old pipeline-stage graph. Efferd-style shadcn
 * blocks: a KPI stat-card row and a per-agent breakdown, scoped to the
 * caller's org and polled every 15s. Cost stays admin-only in /control.
 */
type Props = {
  initialUsage: StudioUsage
}

export function UsageDashboard({ initialUsage }: Props) {
  const { data: usage } = useQuery({
    queryKey: ["studio", "usage"],
    queryFn: () => getStudioUsage(),
    initialData: initialUsage,
    refetchInterval: 15_000,
    staleTime: 0,
  })

  const totalTokens = usage.promptTokens + usage.completionTokens
  const cacheRatio =
    usage.promptTokens > 0 ? usage.cachedTokens / usage.promptTokens : 0

  return (
    <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard
          icon={Cpu}
          label="Tokens"
          value={compact(totalTokens)}
          sub={`${compact(usage.completionTokens)} output`}
        />
        <StatCard
          icon={Activity}
          label="Agent calls"
          value={compact(usage.agentRuns)}
          sub={`${usage.byAgent.length} agents active`}
        />
        <StatCard
          icon={Gauge}
          label="Cache hit ratio"
          value={pct(cacheRatio)}
          sub={`${compact(usage.cachedTokens)} cached`}
        />
      </div>

      <Panel
        title="Usage by agent"
        empty={usage.byAgent.length === 0 ? "No agent runs yet this month." : undefined}
      >
        <AgentBars data={usage.byAgent} />
      </Panel>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: LucideIcon
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-canvas px-4 py-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="flex size-7 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-1.5 text-title-md tabular-nums font-semibold text-foreground leading-none">
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-body-sm text-muted-foreground tabular-nums">
          {sub}
        </p>
      )}
    </div>
  )
}

function Panel({
  title,
  empty,
  children,
}: {
  title: string
  empty?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-border bg-canvas p-4">
      <h2 className="mb-3 text-[11px] uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {empty ? (
        <p className="text-body-sm text-muted-foreground">{empty}</p>
      ) : (
        children
      )}
    </section>
  )
}

function AgentBars({
  data,
}: {
  data: StudioUsage["byAgent"]
}) {
  if (data.length === 0) return null
  const maxTokens = Math.max(...data.map((d) => d.tokens), 1)

  return (
    <ul className="flex flex-col gap-3">
      {data.map((row) => (
        <li key={row.agent} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 text-[12px]">
            <span className="truncate font-medium text-foreground" title={row.agent}>
              {row.agent}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {compact(row.calls)} calls · {compact(row.tokens)} tok
            </span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-pill bg-secondary">
            <div
              className="h-full rounded-pill bg-foreground/80"
              style={{ width: `${Math.max(3, (row.tokens / maxTokens) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

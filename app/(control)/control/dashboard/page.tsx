import Link from "next/link"
import { Activity, AlertTriangle, Building2, DollarSign } from "lucide-react"

import { CostDonut, SpendTrendChart } from "@/components/control/charts"
import { PageHeading, StatCard, StatusPill } from "@/components/control/widgets"
import { compact, pct, relativeTime, usd } from "@/lib/platform/format"
import {
  getGlobalRollup,
  globalDailyTrend,
  listOrgRows,
  listRunsByStatus,
} from "@/lib/platform/queries"
import { getRevenueSummary } from "@/lib/platform/revenue"

export const dynamic = "force-dynamic"

export default async function ControlDashboardPage() {
  const [rollup, orgs, revenue, failing, trend] = await Promise.all([
    getGlobalRollup(),
    listOrgRows(),
    getRevenueSummary(),
    listRunsByStatus(["failed"], 8),
    globalDailyTrend(14),
  ])

  const totalRuns = rollup.succeeded + rollup.failed
  const failureRate = totalRuns > 0 ? rollup.failed / totalRuns : 0
  const modelSlices = Object.entries(rollup.byModel).map(([key, value]) => ({
    name: rollup.modelNames[key] ?? key,
    value,
  }))

  return (
    <div>
      <PageHeading
        title="Overview"
        description={`Platform-wide for ${rollup.period}. Cost and usage update live; tenant health reconciles hourly.`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={DollarSign} label="AI spend (MTD)" value={usd(rollup.usdCost)} sub={`${compact(rollup.agentRuns)} runs`} />
        <StatCard icon={DollarSign} label="Est. MRR" value={usd(revenue.estMrrUsd)} sub={`${revenue.payingOrgs} paying`} />
        <StatCard icon={Building2} label="Active orgs" value={`${rollup.activeOrgs}`} sub={`${orgs.length} total`} />
        <StatCard icon={AlertTriangle} label="Failure rate" value={pct(failureRate)} sub={`${compact(rollup.failed)} failed`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:col-span-2">
          <div className="mb-2 flex items-center gap-2">
            <Activity className="size-4 text-muted-foreground" />
            <h2 className="font-heading text-sm font-semibold tracking-tight">
              Spend - last 14 days
            </h2>
          </div>
          <SpendTrendChart data={trend} />
        </section>
        <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="mb-3 font-heading text-sm font-semibold tracking-tight">
            Cost by model
          </h2>
          <CostDonut data={modelSlices} />
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-heading text-sm font-semibold tracking-tight">
            Top tenants by spend
          </h2>
          <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Org</th>
                  <th className="px-3 py-2 font-medium">Plan</th>
                  <th className="px-3 py-2 text-right font-medium">MTD cost</th>
                </tr>
              </thead>
              <tbody>
                {orgs.slice(0, 6).map((org) => (
                  <tr key={org.orgId} className="border-t border-foreground/5">
                    <td className="px-3 py-2">
                      <Link href={`/tenants/${org.orgId}`} className="hover:underline">
                        {org.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{org.plan}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{usd(org.mtdUsdCost)}</td>
                  </tr>
                ))}
                {orgs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                      No tenant data yet - run the reconciler or seed demo data.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-heading text-sm font-semibold tracking-tight">
            Recent failures
          </h2>
          <div className="flex flex-col gap-2">
            {failing.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-card px-3 py-2 text-sm ring-1 ring-foreground/10"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {run.agentName} <span className="text-muted-foreground">· {run.orgId}</span>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {run.error ?? "no error message"}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusPill status={run.status} />
                  <span className="text-xs text-muted-foreground">
                    {relativeTime(run.startedAt)}
                  </span>
                </div>
              </div>
            ))}
            {failing.length === 0 ? (
              <p className="rounded-lg bg-card px-3 py-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
                No recent failures.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  )
}

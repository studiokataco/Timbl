import { Coins, Cpu, Database, Gauge } from "lucide-react"

import { CostDonut, SpendTrendChart } from "@/components/control/charts"
import { CostBars, PageHeading, StatCard } from "@/components/control/widgets"
import { compact, pct, usd } from "@/lib/platform/format"
import { getGlobalRollup, globalDailyTrend, listOrgRows } from "@/lib/platform/queries"

export const dynamic = "force-dynamic"

export default async function AiUsagePage() {
  const [rollup, orgs, trend] = await Promise.all([
    getGlobalRollup(),
    listOrgRows(),
    globalDailyTrend(14),
  ])

  const cacheRatio =
    rollup.promptTokens > 0 ? rollup.cachedTokens / rollup.promptTokens : 0
  const totalTokens = rollup.promptTokens + rollup.completionTokens
  const modelSlices = Object.entries(rollup.byModel).map(([key, value]) => ({
    name: rollup.modelNames[key] ?? key,
    value,
  }))

  return (
    <div>
      <PageHeading
        title="AI usage & cost"
        description={`Agentic spend across all tenants for ${rollup.period}.`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Coins} label="Total spend" value={usd(rollup.usdCost)} sub={`${compact(rollup.agentRuns)} runs`} />
        <StatCard icon={Cpu} label="Tokens" value={compact(totalTokens)} sub={`${compact(rollup.completionTokens)} output`} />
        <StatCard icon={Gauge} label="Cache hit ratio" value={pct(cacheRatio)} sub={`${compact(rollup.cachedTokens)} cached`} />
        <StatCard icon={Database} label="Embedding calls" value={compact(rollup.embeddingCalls)} sub="indexing + recall" />
      </div>

      <section className="mt-6 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="mb-2 font-heading text-sm font-semibold tracking-tight">
          Spend - last 14 days
        </h2>
        <SpendTrendChart data={trend} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="mb-4 font-heading text-sm font-semibold tracking-tight">
            Cost by model
          </h2>
          <CostDonut data={modelSlices} />
        </section>
        <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="mb-4 font-heading text-sm font-semibold tracking-tight">
            Cost by provider
          </h2>
          <CostBars data={rollup.byProvider} />
        </section>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-heading text-sm font-semibold tracking-tight">
          Cost leaderboard (month to date)
        </h2>
        <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Org</th>
                <th className="px-3 py-2 text-right font-medium">Runs</th>
                <th className="px-3 py-2 text-right font-medium">Spend</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => (
                <tr key={org.orgId} className="border-t border-foreground/5">
                  <td className="px-3 py-2">{org.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{compact(org.mtdAgentRuns)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{usd(org.mtdUsdCost)}</td>
                </tr>
              ))}
              {orgs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                    No usage recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

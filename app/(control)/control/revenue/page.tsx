import { Banknote, Coins, Server, TrendingUp } from "lucide-react"

import { ReportExport } from "@/components/control/report-export"
import { PageHeading, StatCard } from "@/components/control/widgets"
import { compact, usd } from "@/lib/platform/format"
import { getRevenueSummary, getTierFinancials } from "@/lib/platform/revenue"

export const dynamic = "force-dynamic"

export default async function RevenuePage() {
  const [rev, tiers] = await Promise.all([getRevenueSummary(), getTierFinancials()])
  const arr = rev.estMrrUsd * 12

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3">
        <PageHeading
          title="Revenue & financials"
          description="Estimated from assigned plans - Stripe billing (Phase H) is not live, so this is contracted value, not invoiced revenue."
        />
        <ReportExport />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Banknote} label="Est. MRR" value={usd(rev.estMrrUsd)} sub={`${rev.payingOrgs} paying orgs`} />
        <StatCard icon={TrendingUp} label="Est. ARR" value={usd(arr)} />
        <StatCard icon={Server} label="Infra cost (MTD)" value={usd(rev.infraCostMtdUsd)} sub="metered LLM spend" />
        <StatCard
          icon={Coins}
          label="Est. margin"
          value={usd(rev.marginUsd)}
          delta={rev.marginUsd < 0 ? "negative" : undefined}
          sub={rev.marginUsd >= 0 ? "MRR over infra" : "infra over MRR"}
        />
      </div>

      {/* Control by tier - the money view */}
      <section className="mt-8">
        <h2 className="mb-3 font-heading text-sm font-semibold tracking-tight">
          Financials by tier
        </h2>
        <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Tier</th>
                <th className="px-3 py-2 text-right font-medium">Orgs</th>
                <th className="px-3 py-2 text-right font-medium">MRR</th>
                <th className="px-3 py-2 text-right font-medium">ARR</th>
                <th className="px-3 py-2 text-right font-medium">Infra (MTD)</th>
                <th className="px-3 py-2 text-right font-medium">Margin</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t) => (
                <tr key={t.tier} className="border-t border-foreground/5">
                  <td className="px-3 py-2 font-medium capitalize">{t.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{compact(t.orgs)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{usd(t.mrrUsd)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{usd(t.arrUsd)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{usd(t.infraMtdUsd)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${t.marginUsd < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                    {usd(t.marginUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-heading text-sm font-semibold tracking-tight">
          Plan distribution
        </h2>
        <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Plan</th>
                <th className="px-3 py-2 font-medium">Price</th>
                <th className="px-3 py-2 text-right font-medium">Orgs</th>
                <th className="px-3 py-2 text-right font-medium">Est. MRR</th>
              </tr>
            </thead>
            <tbody>
              {rev.breakdown.map((b) => (
                <tr key={b.planId} className="border-t border-foreground/5">
                  <td className="px-3 py-2 font-medium">{b.label}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {b.monthlyPriceUsd === null ? "custom" : `${usd(b.monthlyPriceUsd)}/mo`}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{compact(b.orgs)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{usd(b.estMrrUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Scale tier is custom-priced and excluded from the MRR estimate. Real
          invoices and payment history arrive with Stripe (Phase H).
        </p>
      </section>
    </div>
  )
}

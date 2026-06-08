import "server-only"

import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import { getPlan, PLANS } from "@/lib/plans/plans"

import { getGlobalRollup, listOrgRows, type OrgRow } from "./queries"

/*
 * Revenue view - forward-looking. Stripe (Phase H) is not built, so MRR is
 * computed from each org's assigned plan and the price map in
 * lib/plans/plans.ts. It is an estimate of contracted value, not invoiced
 * revenue. Infra cost is the real metered LLM spend from the rollups.
 */

export interface PlanBreakdown {
  planId: string
  label: string
  tier: string
  orgs: number
  monthlyPriceUsd: number | null
  estMrrUsd: number
}

export interface RevenueSummary {
  estMrrUsd: number
  totalOrgs: number
  payingOrgs: number
  infraCostMtdUsd: number
  marginUsd: number
  breakdown: PlanBreakdown[]
}

export async function getRevenueSummary(): Promise<RevenueSummary> {
  await requirePlatformAdmin()
  const [orgs, rollup] = await Promise.all([listOrgRows(), getGlobalRollup()])

  const counts = new Map<string, number>()
  for (const org of orgs) {
    const planId = getPlan(org.plan).id
    counts.set(planId, (counts.get(planId) ?? 0) + 1)
  }

  const breakdown: PlanBreakdown[] = Object.values(PLANS).map((plan) => {
    const orgsOnPlan = counts.get(plan.id) ?? 0
    const price = plan.monthlyPriceUsd
    return {
      planId: plan.id,
      label: plan.label,
      tier: plan.tier,
      orgs: orgsOnPlan,
      monthlyPriceUsd: price,
      estMrrUsd: price ? price * orgsOnPlan : 0,
    }
  })

  const estMrrUsd = breakdown.reduce((sum, b) => sum + b.estMrrUsd, 0)
  const payingOrgs = breakdown
    .filter((b) => (b.monthlyPriceUsd ?? 0) > 0)
    .reduce((sum, b) => sum + b.orgs, 0)

  return {
    estMrrUsd,
    totalOrgs: orgs.length,
    payingOrgs,
    infraCostMtdUsd: rollup.usdCost,
    marginUsd: estMrrUsd - rollup.usdCost,
    breakdown: breakdown.sort((a, b) => b.estMrrUsd - a.estMrrUsd),
  }
}

/* Pure per-tenant financials from plan + this month's infra spend. No I/O,
 * no guard - callers already hold the org row. */
export interface TenantFinancials {
  tier: string
  planLabel: string
  mrrUsd: number | null
  arrUsd: number | null
  infraMtdUsd: number
  marginUsd: number | null
  includedSeats: number
}

export function tenantFinancials(planId: string | undefined, infraMtdUsd: number): TenantFinancials {
  const plan = getPlan(planId)
  const mrr = plan.monthlyPriceUsd
  return {
    tier: plan.tier,
    planLabel: plan.label,
    mrrUsd: mrr,
    arrUsd: mrr === null ? null : mrr * 12,
    infraMtdUsd,
    marginUsd: mrr === null ? null : mrr - infraMtdUsd,
    includedSeats: plan.includedSeats,
  }
}

/* Financials grouped by tier - the "control-by-tier" money view (lives on the
 * Revenue tab; Tenants links here). */
export interface TierFinancials {
  tier: string
  label: string
  orgs: number
  mrrUsd: number
  arrUsd: number
  infraMtdUsd: number
  marginUsd: number
}

export async function getTierFinancials(): Promise<TierFinancials[]> {
  await requirePlatformAdmin()
  return tierFinancialsFromRows(await listOrgRows())
}

export function tierFinancialsFromRows(rows: OrgRow[]): TierFinancials[] {
  const byTier = new Map<string, TierFinancials>()
  for (const row of rows) {
    const plan = getPlan(row.plan)
    const t = byTier.get(plan.tier) ?? {
      tier: plan.tier,
      label: plan.label,
      orgs: 0,
      mrrUsd: 0,
      arrUsd: 0,
      infraMtdUsd: 0,
      marginUsd: 0,
    }
    t.orgs += 1
    t.mrrUsd += plan.monthlyPriceUsd ?? 0
    t.infraMtdUsd += row.mtdUsdCost
    byTier.set(plan.tier, t)
  }
  const order = ["free", "studio", "agency", "scale"]
  return [...byTier.values()]
    .map((t) => ({ ...t, arrUsd: t.mrrUsd * 12, marginUsd: t.mrrUsd - t.infraMtdUsd }))
    .sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier))
}

import "server-only"

import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import { getPlan, PLANS } from "@/lib/plans/plans"

import { getGlobalRollup, listOrgRows, type OrgRow } from "./queries"

/*
 * Revenue view - forward-looking. Razorpay (Phase H) is not built, so MRR is
 * computed from each org's assigned plan and the INR price map in
 * lib/plans/plans.ts. It is an estimate of contracted value, not invoiced
 * revenue.
 *
 * Subscription money is denominated in INR. Infra cost is the real metered LLM
 * spend, which providers (Anthropic/Gemini) bill in USD - it is converted to
 * INR at the boundary below so the whole money view is single-currency. The
 * rate is an approximate display constant; replace with a live FX rate or
 * actual invoiced figures when Razorpay reconciliation lands.
 */
export const USD_TO_INR = 86

export interface PlanBreakdown {
  planId: string
  label: string
  tier: string
  orgs: number
  monthlyPriceInr: number | null
  estMrrInr: number
}

export interface RevenueSummary {
  estMrrInr: number
  totalOrgs: number
  payingOrgs: number
  infraCostMtdInr: number
  marginInr: number
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
    const price = plan.monthlyPriceInr
    return {
      planId: plan.id,
      label: plan.label,
      tier: plan.tier,
      orgs: orgsOnPlan,
      monthlyPriceInr: price,
      estMrrInr: price ? price * orgsOnPlan : 0,
    }
  })

  const estMrrInr = breakdown.reduce((sum, b) => sum + b.estMrrInr, 0)
  const payingOrgs = breakdown
    .filter((b) => (b.monthlyPriceInr ?? 0) > 0)
    .reduce((sum, b) => sum + b.orgs, 0)
  const infraCostMtdInr = rollup.usdCost * USD_TO_INR

  return {
    estMrrInr,
    totalOrgs: orgs.length,
    payingOrgs,
    infraCostMtdInr,
    marginInr: estMrrInr - infraCostMtdInr,
    breakdown: breakdown.sort((a, b) => b.estMrrInr - a.estMrrInr),
  }
}

/* Pure per-tenant financials from plan + this month's infra spend. No I/O,
 * no guard - callers already hold the org row. `infraMtdUsd` is the real
 * provider spend in USD; it is converted to INR here. */
export interface TenantFinancials {
  tier: string
  planLabel: string
  mrrInr: number | null
  arrInr: number | null
  infraMtdInr: number
  marginInr: number | null
  includedSeats: number
}

export function tenantFinancials(planId: string | undefined, infraMtdUsd: number): TenantFinancials {
  const plan = getPlan(planId)
  const mrr = plan.monthlyPriceInr
  const infraMtdInr = infraMtdUsd * USD_TO_INR
  return {
    tier: plan.tier,
    planLabel: plan.label,
    mrrInr: mrr,
    arrInr: mrr === null ? null : mrr * 12,
    infraMtdInr,
    marginInr: mrr === null ? null : mrr - infraMtdInr,
    includedSeats: plan.includedSeats,
  }
}

/* Financials grouped by tier - the "control-by-tier" money view (lives on the
 * Revenue tab; Tenants links here). */
export interface TierFinancials {
  tier: string
  label: string
  orgs: number
  mrrInr: number
  arrInr: number
  infraMtdInr: number
  marginInr: number
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
      mrrInr: 0,
      arrInr: 0,
      infraMtdInr: 0,
      marginInr: 0,
    }
    t.orgs += 1
    t.mrrInr += plan.monthlyPriceInr ?? 0
    t.infraMtdInr += row.mtdUsdCost * USD_TO_INR
    byTier.set(plan.tier, t)
  }
  const order = ["free", "studio", "agency", "scale"]
  return [...byTier.values()]
    .map((t) => ({ ...t, arrInr: t.mrrInr * 12, marginInr: t.mrrInr - t.infraMtdInr }))
    .sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier))
}

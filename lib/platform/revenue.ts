import "server-only"

import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import { getRazorpay, paidCheckoutAvailable } from "@/lib/billing/razorpay"
import { getPlan, PLANS } from "@/lib/plans/plans"

import { getGlobalRollup, listOrgRows, type OrgRow } from "./queries"

/*
 * Revenue view - MRR is computed from each org's assigned plan and the INR
 * price map in lib/plans/plans.ts. It is an estimate of contracted value;
 * invoiced amounts live in Razorpay. Trials run on the Agency plan id but are
 * counted as their own tier at zero MRR.
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

const TRIAL_TIER = "trial"
const TRIAL_LABEL = "Trial"

function isTrialing(billingStatus: string | null | undefined): boolean {
  return billingStatus === "trialing"
}

export async function getRevenueSummary(): Promise<RevenueSummary> {
  await requirePlatformAdmin()
  const [orgs, rollup] = await Promise.all([listOrgRows(), getGlobalRollup()])

  const counts = new Map<string, number>()
  let trialOrgs = 0
  for (const org of orgs) {
    if (isTrialing(org.billingStatus)) {
      trialOrgs += 1
      continue
    }
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
  breakdown.push({
    planId: TRIAL_TIER,
    label: TRIAL_LABEL,
    tier: TRIAL_TIER,
    orgs: trialOrgs,
    monthlyPriceInr: 0,
    estMrrInr: 0,
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

export function tenantFinancials(
  planId: string | undefined,
  infraMtdUsd: number,
  billingStatus?: string | null,
): TenantFinancials {
  const plan = getPlan(planId)
  const trialing = isTrialing(billingStatus)
  const mrr = trialing ? 0 : plan.monthlyPriceInr
  const infraMtdInr = infraMtdUsd * USD_TO_INR
  return {
    tier: trialing ? TRIAL_TIER : plan.tier,
    planLabel: trialing ? TRIAL_LABEL : plan.label,
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
    const fin = tenantFinancials(row.plan, row.mtdUsdCost, row.billingStatus)
    const t = byTier.get(fin.tier) ?? {
      tier: fin.tier,
      label: fin.planLabel,
      orgs: 0,
      mrrInr: 0,
      arrInr: 0,
      infraMtdInr: 0,
      marginInr: 0,
    }
    t.orgs += 1
    t.mrrInr += fin.mrrInr ?? 0
    t.infraMtdInr += fin.infraMtdInr
    byTier.set(fin.tier, t)
  }
  const order = ["free", TRIAL_TIER, "studio", "agency", "scale"]
  return [...byTier.values()]
    .map((t) => ({ ...t, arrInr: t.mrrInr * 12, marginInr: t.mrrInr - t.infraMtdInr }))
    .sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier))
}

export interface CollectionSubscriptions {
  active: number
  mrrInr: number
}

/* Live from Razorpay: subscriptions actually being charged, as opposed to the
 * assigned-plan estimate above (which includes hand-set promo plans). Null when
 * Razorpay keys are absent or the API is unreachable. */
export async function getCollectionSubscriptions(): Promise<CollectionSubscriptions | null> {
  await requirePlatformAdmin()
  if (!paidCheckoutAvailable()) return null
  try {
    const rzp = getRazorpay()
    const plans = await rzp.plans.all({ count: 100 })
    const paiseByPlan = new Map(plans.items.map((p) => [p.id, Number(p.item.amount)]))
    let active = 0
    let paise = 0
    for (let skip = 0; ; skip += 100) {
      const page = await rzp.subscriptions.all({ count: 100, skip })
      for (const sub of page.items) {
        if (sub.status !== "active") continue
        active += 1
        paise += (paiseByPlan.get(sub.plan_id) ?? 0) * (Number(sub.quantity) || 1)
      }
      if (page.items.length < 100) break
    }
    return { active, mrrInr: paise / 100 }
  } catch (err) {
    console.error("[revenue] razorpay collection fetch failed", err)
    return null
  }
}

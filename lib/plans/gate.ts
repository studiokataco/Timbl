import "server-only"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgAgentConfigsPath, orgPath, orgUsageDocPath } from "@/lib/firebase/paths"
import { isBoutiqueAgent } from "@/lib/agents/defaults"
import type { BillingStatus } from "@/lib/schemas/billing"
import {
  FREE_PLAN_ID,
  getPlan,
  type PlanConfig,
  type PlanFeatureFlag,
  type PlanFeatures,
  type QuotaMetric,
  toPlanFeatures,
} from "./plans"
import { writePlatformSignal } from "@/lib/platform/signals"

/*
 * Plan gating. Server-only - the client never calls these. UI affordances
 * (greyed buttons, upgrade badges) read `PlanFeatures` from a separate
 * client-safe payload; enforcement always happens here, server-side.
 *
 * Gates throw `PlanGateError` so callers can either:
 *   1. let it bubble (default - server action returns `{ ok: false, error }`
 *      because actions catch all throws), or
 *   2. wrap in try/catch when they want to surface a richer upsell.
 *
 * The error carries `tier`, `feature`/`metric`, and `requiredTier` so the
 * client can render the right upgrade prompt without a second round-trip.
 */

export type PlanGateReason =
  | { kind: "feature"; feature: PlanFeatureFlag; currentTier: string }
  | { kind: "quota"; metric: QuotaMetric; limit: number; used: number; currentTier: string }

export class PlanGateError extends Error {
  readonly reason: PlanGateReason
  constructor(reason: PlanGateReason) {
    super(formatGateMessage(reason))
    this.name = "PlanGateError"
    this.reason = reason
  }
}

function formatGateMessage(reason: PlanGateReason): string {
  if (reason.kind === "feature") {
    return `Feature "${reason.feature}" is not available on the ${reason.currentTier} plan.`
  }
  return `Quota exceeded: ${reason.metric} (${reason.used}/${reason.limit}) on the ${reason.currentTier} plan.`
}

function emitQuotaBreachSignal(
  orgId: string,
  metric: QuotaMetric,
  used: number,
  limit: number,
  tier: string,
): void {
  void writePlatformSignal({
    kind: "quota.breached",
    orgId,
    summary: `Quota exceeded: ${metric} (${used}/${limit})`,
    meta: { metric, used, limit, tier },
  }).catch(() => {})
}

/* Read the org's plan + billing status from /organizations/{orgId} in one get.
 * Falls back to free_v1 when the field is missing - billing is live, so an org
 * with no assigned plan is treated as Free (gates engage). Existing orgs were
 * backfilled to an explicit plan before the default flipped (scripts/
 * backfill-org-plans.ts) so nothing downgrades by surprise.
 *
 * Per-org quotaOverrides (set from the control centre) are merged OVER the
 * plan's quotas, so a single org can be granted more (or less) headroom
 * without changing its tier. This is the only quota chokepoint - requireQuota
 * reads through here - so the override applies everywhere automatically.
 *
 * billingStatus mirrors the webhook-stamped /organizations/{id}.billingStatus
 * (the dunning state); defaults to "manual" (no active subscription). */
async function getOrgPlanAndStatus(
  orgId: string,
): Promise<{ plan: PlanConfig; billingStatus: BillingStatus }> {
  const ref = getAdminDb().doc(orgPath(orgId))
  const data = (await ref.get()).data()
  let planId = data?.plan as string | undefined
  let billingStatus = (data?.billingStatus as BillingStatus | undefined) ?? "manual"

  /* Lazy trial expiry: a trialing org past trialEndsAt drops to Free here,
   * with a one-time write-back so it persists (no cron needed). Once written,
   * billingStatus is no longer "trialing" so this never re-fires. */
  const trialEndsAt = data?.trialEndsAt as string | undefined
  if (billingStatus === "trialing" && trialEndsAt && Date.parse(trialEndsAt) < Date.now()) {
    planId = FREE_PLAN_ID
    billingStatus = "canceled"
    await ref.set({ plan: FREE_PLAN_ID, billingStatus: "canceled" }, { merge: true })
  }

  const base = getPlan(planId ?? undefined)
  const overrides = data?.quotaOverrides as
    | Partial<Record<QuotaMetric, number | null>>
    | undefined
  if (!overrides) return { plan: base, billingStatus }
  const quotas = { ...base.quotas }
  for (const metric of Object.keys(quotas) as QuotaMetric[]) {
    if (metric in overrides && overrides[metric] !== undefined) {
      quotas[metric] = overrides[metric] as number | null
    }
  }
  return { plan: { ...base, quotas }, billingStatus }
}

export async function getOrgPlan(orgId: string): Promise<PlanConfig> {
  return (await getOrgPlanAndStatus(orgId)).plan
}

export async function getOrgPlanFeatures(orgId: string): Promise<PlanFeatures> {
  const { plan, billingStatus } = await getOrgPlanAndStatus(orgId)
  return { ...toPlanFeatures(plan), billingStatus }
}

/* Dunning gate. A subscription in `past_due` (payment failed, Razorpay still
 * retrying or halted) blocks new agent runs until payment is fixed. `canceled`
 * orgs are already on Free via the webhook, so their Free quotas apply instead
 * - no separate block needed here. Throws a plain Error so the action wrapper
 * surfaces it as { ok: false, error }. */
export async function requireActiveBilling(orgId: string): Promise<void> {
  const { billingStatus } = await getOrgPlanAndStatus(orgId)
  if (billingStatus === "past_due") {
    throw new Error(
      "Billing is past due. Update your payment method in Settings -> Billing to resume agent runs.",
    )
  }
}

/* Capacity is measured in ENABLED boutique agents, not installed docs:
 * disabling an agent (keeping its config) frees a slot, so switching which
 * agents run is a free user preference rather than an install/delete chore. */
export async function requireAgentCapacity(orgId: string): Promise<void> {
  const plan = await getOrgPlan(orgId)
  const limit = plan.quotas.agents
  if (limit === null) return
  const snap = await getAdminDb()
    .collection(orgAgentConfigsPath(orgId))
    .get()
  const used = snap.docs.filter(
    (d) => isBoutiqueAgent(d.id) && d.data().enabled !== false,
  ).length
  if (used >= limit) {
    emitQuotaBreachSignal(orgId, "agents", used, limit, plan.tier)
    throw new PlanGateError({
      kind: "quota",
      metric: "agents",
      limit,
      used,
      currentTier: plan.tier,
    })
  }
}

/* Throws PlanGateError when the plan doesn't enable the feature. */
export async function requireFeature(
  orgId: string,
  feature: PlanFeatureFlag,
): Promise<PlanConfig> {
  const plan = await getOrgPlan(orgId)
  if (!plan.features[feature]) {
    throw new PlanGateError({ kind: "feature", feature, currentTier: plan.tier })
  }
  return plan
}

function currentPeriod(date = new Date()): string {
  /* YYYY-MM in UTC. Billing cadence is monthly; we don't slice finer than
   * the calendar month for quota purposes. Razorpay invoices are the
   * authoritative billable record - this counter is for UX. */
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

/* Read the current period's usage counter for one metric. Returns 0 when
 * no doc/field exists yet (first run of the month). */
export async function readUsage(
  orgId: string,
  metric: QuotaMetric,
  period = currentPeriod(),
): Promise<number> {
  const snap = await getAdminDb().doc(orgUsageDocPath(orgId, period)).get()
  const value = snap.data()?.[metric]
  return typeof value === "number" ? value : 0
}

/*
 * Throws PlanGateError when adding `cost` to the metric would exceed the
 * plan's quota. `cost` defaults to 1 (one agent run, one scheduled post).
 *
 * Note: this is a *check*, not an increment. The producer is responsible
 * for calling the Phase-C `emitAgentRun` (or equivalent) after the work
 * succeeds - that's what advances the counter. Splitting check-vs-emit
 * means a failed action doesn't burn quota.
 */
export async function requireQuota(
  orgId: string,
  metric: QuotaMetric,
  cost = 1,
): Promise<{ plan: PlanConfig; used: number; limit: number | null }> {
  const plan = await getOrgPlan(orgId)
  const limit = plan.quotas[metric]
  if (limit === null) return { plan, used: 0, limit: null }
  const used = await readUsage(orgId, metric)
  if (used + cost > limit) {
    emitQuotaBreachSignal(orgId, metric, used, limit, plan.tier)
    throw new PlanGateError({
      kind: "quota",
      metric,
      limit,
      used,
      currentTier: plan.tier,
    })
  }
  return { plan, used, limit }
}

/* Helper for server actions: catch a PlanGateError and return it as the
 * canonical ServerActionResult shape with a structured `reason`. Use this
 * at the top of an action when you'd otherwise have to wrap every gate
 * call in try/catch. */
export function gateErrorToResult(err: unknown):
  | { ok: false; error: string; gate: PlanGateReason }
  | null {
  if (err instanceof PlanGateError) {
    return { ok: false, error: err.message, gate: err.reason }
  }
  return null
}

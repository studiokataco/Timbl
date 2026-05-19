import "server-only"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgPath, orgUsageDocPath } from "@/lib/firebase/paths"
import {
  getPlan,
  type PlanConfig,
  type PlanFeatureFlag,
  type PlanFeatures,
  type QuotaMetric,
  toPlanFeatures,
} from "./plans"

/*
 * Plan gating. Server-only — the client never calls these. UI affordances
 * (greyed buttons, upgrade badges) read `PlanFeatures` from a separate
 * client-safe payload; enforcement always happens here, server-side.
 *
 * Gates throw `PlanGateError` so callers can either:
 *   1. let it bubble (default — server action returns `{ ok: false, error }`
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

/* Read the org's current plan from /organizations/{orgId}.plan. Falls back
 * to free_v1 when the field is missing (new orgs land here before the
 * onboarding wizard sets a real value). */
export async function getOrgPlan(orgId: string): Promise<PlanConfig> {
  const snap = await getAdminDb().doc(orgPath(orgId)).get()
  const planId = (snap.data()?.plan as string | undefined) ?? undefined
  return getPlan(planId)
}

export async function getOrgPlanFeatures(orgId: string): Promise<PlanFeatures> {
  return toPlanFeatures(await getOrgPlan(orgId))
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
   * the calendar month for quota purposes. Stripe meter events are the
   * authoritative billable record — this counter is for UX. */
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
 * succeeds — that's what advances the counter. Splitting check-vs-emit
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

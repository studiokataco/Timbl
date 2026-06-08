/*
 * Plans config - the single source of truth for what each subscription tier
 * unlocks. Lives in code (not Firestore) so:
 *
 *   - It's versioned in git, reviewable in PRs.
 *   - Limit/feature changes need a code deploy, not a console click.
 *   - Subscriptions reference a plan *id* (e.g. studio_v1), letting us
 *     ship `studio_v2` for new signups while existing customers stay on v1.
 *     This is how we grandfather without manual data migrations.
 *
 * Gating happens in `lib/plans/gate.ts`. Server actions call
 * `requireFeature` / `requireQuota` before any side-effect; the client
 * never enforces - it only reads `planFeatures` to grey out buttons.
 */

export type PlanTier = "free" | "studio" | "agency" | "scale"

export type PlanFeatureFlag =
  | "multiStepApproval"
  | "customCategories"
  | "templates"
  | "whiteLabel"
  | "priorityQueue"
  | "byoKeys"
  | "sso"
  | "auditLog"
  | "sla"

/* Metrics tracked per org per billing period. A value of `null` means
 * unlimited under this plan. */
export type QuotaMetric = "agentRuns" | "scheduledPosts" | "brands" | "seats"

export type PlanConfig = {
  id: string
  tier: PlanTier
  /* Display name and price for the upgrade UI. Prices are in INR rupees
   * (whole rupees, not paise). Razorpay plan ids live in env, not here -
   * this config stays env-agnostic; the billing layer maps id -> env. */
  label: string
  monthlyPriceInr: number | null
  perBrandPriceInr?: number
  /* `null` = unlimited. */
  quotas: Record<QuotaMetric, number | null>
  features: Record<PlanFeatureFlag, boolean>
  /* Brand/seat counts INCLUDED in the base price; overage is metered per
   * the per-brand surcharge above. */
  includedBrands: number
  includedSeats: number
}

export const PLANS: Record<string, PlanConfig> = {
  free_v1: {
    id: "free_v1",
    tier: "free",
    label: "Free",
    monthlyPriceInr: 0,
    quotas: { agentRuns: 100, scheduledPosts: 30, brands: 1, seats: 2 },
    features: {
      multiStepApproval: false,
      customCategories: true,
      /* Templates are core to the planning workflow and not yet a paid
       * differentiator (billing is deferred). Gating them blocked admins of
       * free-tier orgs from creating any template at all. */
      templates: true,
      whiteLabel: false,
      priorityQueue: false,
      byoKeys: false,
      sso: false,
      auditLog: false,
      sla: false,
    },
    includedBrands: 1,
    includedSeats: 2,
  },
  studio_v1: {
    id: "studio_v1",
    tier: "studio",
    label: "Studio",
    monthlyPriceInr: 2999,
    quotas: { agentRuns: 1500, scheduledPosts: null, brands: 1, seats: 5 },
    features: {
      multiStepApproval: false,
      customCategories: true,
      templates: true,
      whiteLabel: false,
      priorityQueue: false,
      byoKeys: false,
      sso: false,
      auditLog: false,
      sla: false,
    },
    includedBrands: 1,
    includedSeats: 5,
  },
  agency_v1: {
    id: "agency_v1",
    tier: "agency",
    label: "Agency",
    monthlyPriceInr: 11999,
    perBrandPriceInr: 5999,
    quotas: { agentRuns: 5000, scheduledPosts: null, brands: 3, seats: 15 },
    features: {
      multiStepApproval: true,
      customCategories: true,
      templates: true,
      whiteLabel: true,
      priorityQueue: true,
      byoKeys: true,
      sso: false,
      auditLog: true,
      sla: false,
    },
    includedBrands: 3,
    includedSeats: 15,
  },
  scale_v1: {
    id: "scale_v1",
    tier: "scale",
    label: "Scale",
    /* Custom pricing - not self-serve. */
    monthlyPriceInr: null,
    quotas: { agentRuns: null, scheduledPosts: null, brands: null, seats: null },
    features: {
      multiStepApproval: true,
      customCategories: true,
      templates: true,
      whiteLabel: true,
      priorityQueue: true,
      byoKeys: true,
      sso: true,
      auditLog: true,
      sla: true,
    },
    includedBrands: 10,
    includedSeats: 50,
  },
}

/* Fallback when /organizations/{id}.plan is missing. Pilot/dev uses the
 * top self-serve tier so gates stay off until Razorpay billing ships. */
export const DEFAULT_PLAN_ID = "agency_v1"

export function getPlan(planId: string | undefined | null): PlanConfig {
  if (planId && PLANS[planId]) return PLANS[planId]
  return PLANS[DEFAULT_PLAN_ID]
}

/* Public projection for client UI affordances. Stripped of pricing so
 * the client can render upgrade prompts without leaking the full
 * pricing matrix. (Pricing for the upgrade page is fetched separately
 * from a dedicated endpoint when we wire Razorpay.) */
export type PlanFeatures = {
  planId: string
  tier: PlanTier
  label: string
  features: Record<PlanFeatureFlag, boolean>
  quotas: Record<QuotaMetric, number | null>
}

export function toPlanFeatures(plan: PlanConfig): PlanFeatures {
  return {
    planId: plan.id,
    tier: plan.tier,
    label: plan.label,
    features: plan.features,
    quotas: plan.quotas,
  }
}

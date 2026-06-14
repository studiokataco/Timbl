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

import type { BillingStatus } from "@/lib/schemas/billing"

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
export type QuotaMetric = "agentRuns" | "scheduledPosts" | "brands" | "seats" | "agents"

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
    quotas: { agentRuns: 100, scheduledPosts: 30, brands: 1, seats: 2, agents: 0 },
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
    quotas: { agentRuns: 1500, scheduledPosts: null, brands: 1, seats: 5, agents: 5 },
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
    quotas: { agentRuns: 5000, scheduledPosts: null, brands: 3, seats: 15, agents: 20 },
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
    quotas: { agentRuns: null, scheduledPosts: null, brands: null, seats: null, agents: null },
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

/* Fallback when /organizations/{id}.plan is missing. Billing is live, so an
 * unassigned org is treated as Free and gates engage. Existing orgs were
 * backfilled to an explicit plan first (scripts/backfill-org-plans.ts) so the
 * flip from agency_v1 grandfathers them. */
export const DEFAULT_PLAN_ID = "free_v1"

/* The tier an org lands on when a subscription is cancelled/expires. */
export const FREE_PLAN_ID = "free_v1"

/* 30-day no-card trial grants the Agency tier, then reverts to Free. */
export const TRIAL_PLAN_ID = "agency_v1"
export const TRIAL_DAYS = 30

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
  /* Dunning state for UI affordances (the billing banner). Attached by
   * getOrgPlanFeatures; absent on the bare toPlanFeatures projection. */
  billingStatus?: BillingStatus
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

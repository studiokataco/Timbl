import type { PricingTier } from "@/components/marketing/pricing-card"
import { PLANS, TRIAL_DAYS, type PlanConfig } from "@/lib/plans/plans"

export const BUYABLE_PLAN_IDS = ["studio_v1", "agency_v1"] as const
export type BuyablePlanId = (typeof BUYABLE_PLAN_IDS)[number]

export function isBuyablePlanId(id: string | undefined): id is BuyablePlanId {
  return BUYABLE_PLAN_IDS.includes(id as BuyablePlanId)
}

export const SCALE_CONTACT_HREF = "/signup"
export const SCALE_CONTACT_LABEL = "Talk to us"

const DESCRIPTORS: Record<string, string> = {
  free_v1: "Plan with Timbl, Go Solo",
  studio_v1: "Manage your brand with Timbl",
  agency_v1: "For multi-disciplinary teams handling client brands",
  scale_v1: "For large organizations",
}

const FOOTNOTES: Record<string, string> = {
  free_v1: `No credit card required. Includes a ${TRIAL_DAYS}-day Agency trial.`,
  studio_v1: "Cancel anytime. Your plan unlocks once payment is confirmed.",
  agency_v1: "Cancel anytime. Your plan unlocks once payment is confirmed.",
}

export function rupees(n: number): string {
  return `Rs ${n.toLocaleString("en-IN")}`
}

function highlights(plan: PlanConfig): string[] {
  const out: string[] = []
  const runs = plan.quotas.agentRuns
  if (runs === null) out.push("Unlimited AI agent runs")
  else if (runs > 0) out.push(`${runs.toLocaleString("en-IN")} AI agent runs/month`)
  out.push(
    plan.quotas.scheduledPosts === null
      ? "Unlimited scheduled posts"
      : `${plan.quotas.scheduledPosts} scheduled posts/month`,
  )
  out.push(
    plan.includedBrands === 1 ? "1 brand included" : `${plan.includedBrands} brands included`,
  )
  out.push(`${plan.includedSeats} team seats`)
  if (plan.includedCustomCategories !== null)
    out.push(`${plan.includedCustomCategories} custom categories`)
  if (plan.monthlyPriceInr !== 0) out.push("MCP, CLI and API access")
  if (plan.supportLabel) out.push(plan.supportLabel)
  if (plan.features.sso) out.push("SSO, audit log and SLA")
  if (plan.features.multiStepApproval) out.push("Multi-step approvals")
  return out.slice(0, 7)
}

/* `buyable` switches paid tiers from the invite queue to direct checkout,
 * keeping the invite path as a secondary link. */
export function toPricingTier(plan: PlanConfig, opts: { buyable: boolean }): PricingTier {
  const isPaid = Boolean(plan.monthlyPriceInr)
  const buy = opts.buyable && isPaid && isBuyablePlanId(plan.id)

  const cta =
    plan.monthlyPriceInr === null
      ? { label: SCALE_CONTACT_LABEL, href: SCALE_CONTACT_HREF }
      : plan.monthlyPriceInr === 0
        ? { label: `Start ${TRIAL_DAYS}-day free trial`, href: "/signup?plan=trial" }
        : buy
          ? { label: `Buy ${plan.label}`, href: `/checkout?plan=${plan.id}` }
          : { label: "Get started", href: `/signup?plan=${plan.id}` }

  return {
    id: plan.id,
    label: plan.label,
    descriptor: DESCRIPTORS[plan.id] ?? "",
    priceLabel:
      plan.monthlyPriceInr === null
        ? "Custom"
        : plan.monthlyPriceInr === 0
          ? "Free"
          : rupees(plan.monthlyPriceInr),
    priceSuffix: plan.monthlyPriceInr ? "/mo" : null,
    /* No self-serve per-brand overage: createBrand hard-caps at the included
     * count and more brands means moving up a tier, so the page must not imply
     * brands are individually buyable. */
    perBrandNote: null,
    highlights: highlights(plan),
    featured: plan.id === "agency_v1",
    footnote: FOOTNOTES[plan.id] ?? "",
    cta,
    secondaryCta: buy
      ? { label: "Or request free access", href: `/request-invite?plan=${plan.id}` }
      : null,
  }
}

export function pricingTierFor(planId: BuyablePlanId): PricingTier {
  return toPricingTier(PLANS[planId], { buyable: true })
}

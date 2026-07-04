import type { Metadata } from "next"

import { CtaBand } from "@/components/marketing/cta-band"
import { MarketingFooter } from "@/components/marketing/marketing-footer"
import { MarketingNav } from "@/components/marketing/marketing-nav"
import { PricingSection } from "@/components/marketing/pricing-section"
import type { PricingTier } from "@/components/marketing/pricing-card"
import { PLANS, TRIAL_DAYS, type PlanConfig } from "@/lib/plans/plans"

export const dynamic = "force-dynamic"

const TITLE = "Pricing - Timbl"
const DESCRIPTION =
  "Transparent pricing that scales with your needs. Start free, upgrade when your content engine does. No hidden fees, cancel anytime."

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/pricing" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/pricing" },
  twitter: { title: TITLE, description: DESCRIPTION },
}

const DESCRIPTORS: Record<string, string> = {
  free_v1: "For trying Timbl solo",
  studio_v1: "For one brand run seriously",
  agency_v1: "For teams managing client brands",
  scale_v1: "For large organizations",
}

const FOOTNOTES: Record<string, string> = {
  free_v1: `No credit card required. Includes a ${TRIAL_DAYS}-day Agency trial.`,
  studio_v1: "Cancel anytime. Your plan unlocks once payment is confirmed.",
  agency_v1: "Cancel anytime. Your plan unlocks once payment is confirmed.",
  scale_v1: "Custom pricing, onboarding and contracts.",
}

function rupees(n: number): string {
  return `Rs ${n.toLocaleString("en-IN")}`
}

function highlights(plan: PlanConfig): string[] {
  const out: string[] = []
  const runs = plan.quotas.agentRuns
  out.push(
    runs === null
      ? "Unlimited AI agent runs"
      : `${runs.toLocaleString("en-IN")} AI agent runs/month`,
  )
  out.push(
    plan.quotas.scheduledPosts === null
      ? "Unlimited scheduled posts"
      : `${plan.quotas.scheduledPosts} scheduled posts/month`,
  )
  out.push(
    plan.includedBrands === 1 ? "1 brand included" : `${plan.includedBrands} brands included`,
  )
  out.push(`${plan.includedSeats} team seats`)
  if (plan.features.multiStepApproval) out.push("Multi-step approvals")
  if (plan.features.whiteLabel) out.push("White-label client views")
  if (plan.features.byoKeys) out.push("Bring your own AI keys")
  if (plan.features.sso) out.push("SSO, audit log and SLA")
  return out.slice(0, 7)
}

/* PRICING_SELF_SERVE_ENABLED (lib/billing/self-serve.ts) will route paid CTAs
 * straight into checkout once pre-auth purchase ships; until then every CTA
 * goes through the invite flow with the plan captured as a query param. */
function toTier(plan: PlanConfig): PricingTier {
  const paidCta = { label: "Get started", href: `/signup?plan=${plan.id}` }
  const cta =
    plan.monthlyPriceInr === null
      ? { label: "Contact us", href: "mailto:hello@timbl.app?subject=Timbl%20Scale" }
      : plan.monthlyPriceInr === 0
        ? { label: `Start ${TRIAL_DAYS}-day free trial`, href: "/signup?plan=trial" }
        : paidCta

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
    perBrandNote: plan.perBrandPriceInr
      ? `+ ${rupees(plan.perBrandPriceInr)}/mo per extra brand`
      : null,
    highlights: highlights(plan),
    featured: plan.id === "agency_v1",
    footnote: FOOTNOTES[plan.id] ?? "",
    cta,
  }
}

const TIER_ORDER = ["free_v1", "studio_v1", "agency_v1", "scale_v1"]

export default function PricingPage() {
  const tiers = TIER_ORDER.filter((id) => PLANS[id]).map((id) => toTier(PLANS[id]))

  return (
    <div
      id="landing-scroll"
      className="flex-1 overflow-y-auto bg-background text-foreground"
    >
      <MarketingNav />
      <main>
        <PricingSection tiers={tiers} />
        <CtaBand />
      </main>
      <MarketingFooter />
    </div>
  )
}

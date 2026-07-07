import type { Metadata } from "next"

import { MarketingFooter } from "@/components/marketing/marketing-footer"
import { MarketingNav } from "@/components/marketing/marketing-nav"
import { PricingBanner } from "@/components/marketing/pricing-banner"
import {
  PricingCompare,
  type CompareGroup,
  type ComparePlanColumn,
} from "@/components/marketing/pricing-compare"
import { PricingFaq } from "@/components/marketing/pricing-faq"
import { PricingSection } from "@/components/marketing/pricing-section"
import { TIER_HEX, type PricingTier } from "@/components/marketing/pricing-card"
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

function rupees(n: number): string {
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

function quota(n: number | null): string {
  return n === null ? "Unlimited" : n.toLocaleString("en-IN")
}

function compareColumns(plans: PlanConfig[]): ComparePlanColumn[] {
  return plans.map((plan) => {
    const tier = toTier(plan)
    return {
      id: plan.id,
      label: plan.label,
      priceLabel:
        tier.priceLabel === "Free" || tier.priceLabel === "Custom"
          ? tier.priceLabel
          : `${tier.priceLabel}/mo`,
      hex: TIER_HEX[plan.id] ?? null,
      cta: tier.cta,
    }
  })
}

function compareGroups(plans: PlanConfig[]): CompareGroup[] {
  const flag = (key: keyof PlanConfig["features"]) =>
    plans.map((p) => p.features[key])
  return [
    {
      title: "Usage",
      rows: [
        {
          label: "AI agent runs/month",
          values: plans.map((p) => (p.quotas.agentRuns === 0 ? null : quota(p.quotas.agentRuns))),
        },
        {
          label: "Awareness research runs/month",
          values: plans.map((p) => {
            const cap = p.agentInvocationCaps["awareness-researcher"]
            return cap === 0 ? null : quota(cap ?? null)
          }),
        },
        {
          label: "Scheduled posts/month",
          values: plans.map((p) => quota(p.quotas.scheduledPosts)),
        },
        { label: "Brands included", values: plans.map((p) => quota(p.includedBrands)) },
        {
          label: "Extra brands",
          values: plans.map((p) =>
            p.perBrandPriceInr
              ? `${rupees(p.perBrandPriceInr)}/mo each`
              : p.monthlyPriceInr === null
                ? "Custom"
                : null,
          ),
        },
        { label: "Team seats", values: plans.map((p) => quota(p.includedSeats)) },
        {
          label: "Boutique agents",
          values: plans.map((p) => (p.quotas.agents === 0 ? null : quota(p.quotas.agents))),
        },
      ],
    },
    {
      title: "Planning and collaboration",
      rows: [
        {
          label: "Custom categories",
          values: plans.map((p) => quota(p.includedCustomCategories)),
        },
        { label: "Templates", values: flag("templates") },
        { label: "Multi-step approvals", values: flag("multiStepApproval") },
        { label: "Priority queue", values: flag("priorityQueue") },
      ],
    },
    {
      title: "Platform and support",
      rows: [
        {
          label: "MCP, CLI and API access",
          values: plans.map((p) => p.monthlyPriceInr !== 0),
        },
        {
          label: "Support",
          values: plans.map((p) => p.supportLabel),
        },
      ],
    },
  ]
}

export default function PricingPage() {
  const plans = TIER_ORDER.filter((id) => PLANS[id]).map((id) => PLANS[id])
  const tiers = plans.map(toTier)

  return (
    <div
      id="landing-scroll"
      className="flex-1 overflow-y-auto bg-background text-foreground"
    >
      <MarketingNav />
      <main>
        <PricingSection tiers={tiers} />
        <PricingCompare plans={compareColumns(plans)} groups={compareGroups(plans)} />
        <PricingBanner />
        <PricingFaq />
      </main>
      <MarketingFooter />
    </div>
  )
}

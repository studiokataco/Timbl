import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

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
import { TIER_HEX } from "@/components/marketing/pricing-card"
import { paidCheckoutAvailable } from "@/lib/billing/razorpay"
import { pricingSelfServeEnabled } from "@/lib/billing/self-serve"
import { PLANS, type PlanConfig } from "@/lib/plans/plans"
import {
  SCALE_CONTACT_HREF,
  SCALE_CONTACT_LABEL,
  toPricingTier,
} from "@/lib/plans/pricing-tiers"

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

const TIER_ORDER = ["free_v1", "studio_v1", "agency_v1"]
const COMPARE_ORDER = [...TIER_ORDER, "scale_v1"]

function quota(n: number | null): string {
  return n === null ? "Unlimited" : n.toLocaleString("en-IN")
}

function compareColumns(plans: PlanConfig[], buyable: boolean): ComparePlanColumn[] {
  return plans.map((plan) => {
    const tier = toPricingTier(plan, { buyable })
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

function ScaleContactBand() {
  return (
    <section
      aria-labelledby="scale-contact-heading"
      className="-mt-14 px-6 pb-24 md:-mt-20 md:pb-32"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-5 rounded-2xl bg-surface-soft px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-10 sm:px-8">
        <div className="min-w-0">
          <h2 id="scale-contact-heading" className="text-sm font-semibold tracking-tight">
            Scale
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            For large organizations. Unlimited agent runs and scheduled posts, SSO,
            audit log and an SLA, priced to your contract.
          </p>
        </div>
        <Link
          href={SCALE_CONTACT_HREF}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-sm text-sm font-semibold text-foreground transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-soft"
        >
          {SCALE_CONTACT_LABEL}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    </section>
  )
}

export default function PricingPage() {
  const plans = TIER_ORDER.filter((id) => PLANS[id]).map((id) => PLANS[id])
  const comparePlans = COMPARE_ORDER.filter((id) => PLANS[id]).map((id) => PLANS[id])
  const buyable = pricingSelfServeEnabled() && paidCheckoutAvailable()
  const tiers = plans.map((plan) => toPricingTier(plan, { buyable }))

  return (
    <div
      id="landing-scroll"
      className="flex-1 bg-background text-foreground"
    >
      <MarketingNav />
      <main>
        <PricingSection tiers={tiers} />
        <ScaleContactBand />
        <PricingCompare
          plans={compareColumns(comparePlans, buyable)}
          groups={compareGroups(comparePlans)}
        />
        <PricingBanner />
        <PricingFaq />
      </main>
      <MarketingFooter />
    </div>
  )
}

export const dynamic = "force-dynamic"

import { getSubscriptionStatus } from "@/lib/actions/billing"
import { getUsageOverview } from "@/lib/actions/usage"
import { paidCheckoutAvailable } from "@/lib/billing/razorpay"
import { billingSelfServeEnabled } from "@/lib/billing/self-serve"
import { PLANS, type PlanConfig } from "@/lib/plans/plans"
import { UsageOverview } from "@/components/settings/usage-overview"
import { BillingPageGate } from "@/components/settings/billing-page-gate"
import {
  BillingManager,
  type BillingPlanCard,
} from "@/components/settings/billing-manager"
import { SettingsPage } from "@/components/settings/settings-page"

const PLAN_ORDER = ["free_v1", "studio_v1", "agency_v1", "scale_v1"]

function highlights(plan: PlanConfig): string[] {
  const out: string[] = []
  const runs = plan.quotas.agentRuns
  out.push(
    runs === null
      ? "Unlimited agent runs"
      : runs === 0
        ? "No agent runs"
        : `${runs.toLocaleString("en-IN")} agent runs a month`,
  )
  out.push(plan.includedSeats === 1 ? "1 seat" : `${plan.includedSeats} seats`)
  out.push(plan.includedBrands === 1 ? "1 brand" : `${plan.includedBrands} brands`)
  if (plan.features.multiStepApproval) out.push("Multi-step approvals")
  if (plan.features.whiteLabel) out.push("White-label")
  if (plan.features.byoKeys) out.push("Bring your own keys")
  if (plan.features.sso) out.push("SSO, audit log and SLA")
  return out.slice(0, 5)
}

function toCard(plan: PlanConfig): BillingPlanCard {
  return {
    id: plan.id,
    label: plan.label,
    tier: plan.tier,
    monthlyPriceInr: plan.monthlyPriceInr,
    perBrandPriceInr: plan.perBrandPriceInr ?? null,
    highlights: highlights(plan),
    billable: Boolean(plan.monthlyPriceInr && plan.monthlyPriceInr > 0),
  }
}

export default async function SettingsPlanPage() {
  const billingLive = billingSelfServeEnabled()
  const usage = await getUsageOverview()

  return (
    <SettingsPage
      title="Plan & billing"
      description="What this workspace uses each month, and the plan behind it."
    >
      <UsageOverview initial={usage} canCompare={billingLive} />
      {billingLive ? <BillingLive /> : <BillingPageGate planLabel={usage.planLabel} />}
    </SettingsPage>
  )
}

async function BillingLive() {
  const current = await getSubscriptionStatus()
  const plans = PLAN_ORDER.filter((id) => PLANS[id]).map((id) => toCard(PLANS[id]))

  return (
    <BillingManager
      current={current}
      plans={plans}
      paidCheckoutAvailable={paidCheckoutAvailable()}
    />
  )
}

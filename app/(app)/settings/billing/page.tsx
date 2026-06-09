export const dynamic = "force-dynamic"

import { getSubscriptionStatus } from "@/lib/actions/billing"
import { paidCheckoutAvailable } from "@/lib/billing/razorpay"
import { PLANS, type PlanConfig } from "@/lib/plans/plans"
import {
  BillingManager,
  type BillingPlanCard,
} from "@/components/settings/billing-manager"

const PLAN_ORDER = ["free_v1", "studio_v1", "agency_v1", "scale_v1"]

function highlights(plan: PlanConfig): string[] {
  const out: string[] = []
  const runs = plan.quotas.agentRuns
  out.push(runs === null ? "Unlimited agent runs" : `${runs.toLocaleString("en-IN")} agent runs/mo`)
  out.push(`${plan.includedSeats} seats`)
  out.push(plan.includedBrands === 1 ? "1 brand" : `${plan.includedBrands} brands`)
  if (plan.features.multiStepApproval) out.push("Multi-step approvals")
  if (plan.features.whiteLabel) out.push("White-label")
  if (plan.features.byoKeys) out.push("Bring your own keys")
  if (plan.features.sso) out.push("SSO + audit + SLA")
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

export default async function SettingsBillingPage() {
  const current = await getSubscriptionStatus()
  const plans = PLAN_ORDER.filter((id) => PLANS[id]).map((id) => toCard(PLANS[id]))

  return (
    <div className="px-4 sm:px-6 py-4 flex-1">
      <div className="mb-4">
        <h1 className="text-lg font-medium">Billing</h1>
        <p className="text-xs text-muted-foreground">
          Manage your subscription and plan. Prices are in INR.
        </p>
      </div>
      <BillingManager
        current={current}
        plans={plans}
        paidCheckoutAvailable={paidCheckoutAvailable()}
      />
    </div>
  )
}

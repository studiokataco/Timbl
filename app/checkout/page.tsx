import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AuthPageShell } from "@/components/auth/auth-page-shell"
import { CheckoutFlow } from "@/components/checkout/checkout-flow"
import { readSessionAuth } from "@/lib/auth/session"
import { paidCheckoutAvailable } from "@/lib/billing/razorpay"
import { pricingSelfServeEnabled } from "@/lib/billing/self-serve"
import { PLANS } from "@/lib/plans/plans"
import { isBuyablePlanId, pricingTierFor, rupees } from "@/lib/plans/pricing-tiers"

export const dynamic = "force-dynamic"

type Search = { searchParams: Promise<{ plan?: string }> }

export async function generateMetadata({ searchParams }: Search): Promise<Metadata> {
  const { plan } = await searchParams
  const label = isBuyablePlanId(plan) ? PLANS[plan].label : "a plan"
  return {
    title: `Buy ${label}`,
    robots: { index: false, follow: false },
  }
}

export default async function CheckoutPage({ searchParams }: Search) {
  const { plan } = await searchParams
  if (!isBuyablePlanId(plan)) redirect("/pricing")
  if (!pricingSelfServeEnabled() || !paidCheckoutAvailable()) {
    redirect(`/request-invite?plan=${plan}`)
  }

  const auth = await readSessionAuth()
  const config = PLANS[plan]

  return (
    <AuthPageShell wide>
      <CheckoutFlow
        planId={plan}
        planLabel={config.label}
        priceLabel={rupees(config.monthlyPriceInr ?? 0)}
        tier={pricingTierFor(plan)}
        signedInEmail={auth?.email ?? null}
        hasWorkspace={Boolean(auth?.workspace)}
      />
    </AuthPageShell>
  )
}

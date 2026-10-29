"use client"

import Link from "next/link"

import { usePlanFeatures } from "@/lib/plans/client"

/*
 * Dunning banner. Shows when the org's subscription is past_due (payment
 * failed, Razorpay retrying or halted) - agent runs are blocked server-side
 * until payment is fixed, so this is the user's prompt to act. Reads the
 * webhook-stamped billingStatus from the plan-features context (no fetch).
 */
export function DunningBanner() {
  const { billingStatus } = usePlanFeatures()
  if (billingStatus !== "past_due") return null

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-500/15 dark:bg-amber-500/20 px-4 py-2 text-center text-sm text-foreground">
      <span>Your payment is past due - agent runs are paused.</span>
      <Link href="/settings/billing" className="font-medium underline underline-offset-2">
        Update billing
      </Link>
    </div>
  )
}

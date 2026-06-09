import "server-only"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgPath } from "@/lib/firebase/paths"
import { platformBillingDocPath } from "@/lib/platform/schema"
import { FREE_PLAN_ID } from "@/lib/plans/plans"
import type { BillingStatus } from "@/lib/schemas/billing"

/*
 * Razorpay subscription webhook -> app state. The subscription was created
 * (lib/actions/billing.ts) with notes.orgId + notes.planId, so every event
 * carries the tenant + tier it belongs to. This module is the only place a
 * paid tier is unlocked - the checkout flow never advances org.plan.
 */

type SubEntity = {
  id: string
  status: string
  notes?: Record<string, string> | null
}

export type RazorpayEvent = {
  event: string
  payload?: { subscription?: { entity?: SubEntity } }
}

/* event -> (normalised billing status, what to do with org.plan):
 *   "paid" -> assign the purchased tier (notes.planId)
 *   "free" -> downgrade to FREE_PLAN_ID
 *   null   -> leave the plan untouched, only update billing status */
function decide(
  event: string,
): { status: BillingStatus; planTarget: "paid" | "free" | null } | null {
  switch (event) {
    case "subscription.activated":
    case "subscription.charged":
    case "subscription.resumed":
      return { status: "active", planTarget: "paid" }
    case "subscription.authenticated":
      return { status: "trialing", planTarget: null }
    case "subscription.pending":
    case "subscription.halted":
    case "subscription.paused":
      return { status: "past_due", planTarget: null }
    case "subscription.cancelled":
    case "subscription.completed":
    case "subscription.expired":
      return { status: "canceled", planTarget: "free" }
    default:
      return null
  }
}

export async function applyRazorpayEvent(
  evt: RazorpayEvent,
): Promise<{ handled: boolean; note: string }> {
  const decision = decide(evt.event)
  if (!decision) return { handled: false, note: `ignored ${evt.event}` }

  const sub = evt.payload?.subscription?.entity
  if (!sub) return { handled: false, note: `no subscription entity on ${evt.event}` }

  const orgId = sub.notes?.orgId
  const planId = sub.notes?.planId
  if (!orgId) return { handled: false, note: `no orgId in notes on ${sub.id}` }

  const db = getAdminDb()

  if (decision.planTarget === "paid" && planId) {
    await db.doc(orgPath(orgId)).set({ plan: planId }, { merge: true })
  } else if (decision.planTarget === "free") {
    await db.doc(orgPath(orgId)).set({ plan: FREE_PLAN_ID }, { merge: true })
  }

  await db.doc(platformBillingDocPath(orgId)).set(
    {
      status: decision.status,
      razorpaySubscriptionId: sub.id,
      razorpaySubscriptionStatus: sub.status,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  )

  const plan =
    decision.planTarget === "free" ? FREE_PLAN_ID : decision.planTarget === "paid" ? planId : null
  return {
    handled: true,
    note: `${evt.event} -> ${decision.status}${plan ? ` (plan: ${plan})` : ""}`,
  }
}

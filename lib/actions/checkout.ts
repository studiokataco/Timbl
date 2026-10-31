"use server"

import { getAdminDb } from "@/lib/firebase/admin"
import { readSessionAuth } from "@/lib/auth/session"
import { paidCheckoutAvailable, getRazorpay, razorpayKeyId, razorpayPlanIdFor } from "@/lib/billing/razorpay"
import { pricingSelfServeEnabled } from "@/lib/billing/self-serve"
import { platformCheckoutDocPath } from "@/lib/platform/schema"
import { isBuyablePlanId } from "@/lib/plans/pricing-tiers"

/*
 * Public /checkout: buy a paid plan without an existing workspace. The buyer
 * is signed in (Google) but has no org yet, so the subscription carries the
 * buyer instead of an orgId. lib/billing/webhook.ts creates the workspace on
 * subscription.activated and writes its id back onto the checkout doc.
 */

const BILLING_CYCLES = 120

export type StartCheckoutResult =
  | { ok: true; subscriptionId: string; keyId: string }
  | { ok: false; error: string }

export type CheckoutStatus =
  | { state: "pending" }
  | { state: "ready"; organizationId: string }
  | { state: "failed"; error: string }

export async function startPublicCheckout(planId: string): Promise<StartCheckoutResult> {
  if (!pricingSelfServeEnabled() || !paidCheckoutAvailable()) {
    return { ok: false, error: "Checkout is not available right now." }
  }
  if (!isBuyablePlanId(planId)) return { ok: false, error: "That plan can't be bought online." }

  const auth = await readSessionAuth()
  if (!auth) return { ok: false, error: "Sign in to continue." }

  const razorpayPlanId = razorpayPlanIdFor(planId)
  if (!razorpayPlanId) return { ok: false, error: "Checkout is not available right now." }

  try {
    const sub = await getRazorpay().subscriptions.create({
      plan_id: razorpayPlanId,
      total_count: BILLING_CYCLES,
      quantity: 1,
      customer_notify: 1,
      notes: { intent: "new_workspace", planId, buyerEmail: auth.email, buyerUid: auth.uid },
    })
    const now = new Date().toISOString()
    await getAdminDb().doc(platformCheckoutDocPath(sub.id)).set({
      subscriptionId: sub.id,
      planId,
      email: auth.email,
      uid: auth.uid,
      status: sub.status,
      organizationId: null,
      createdAt: now,
      updatedAt: now,
    })
    return { ok: true, subscriptionId: sub.id, keyId: razorpayKeyId() }
  } catch (err) {
    console.error("[checkout] subscription create failed", err)
    return { ok: false, error: "Couldn't start checkout. Try again in a moment." }
  }
}

export async function getPublicCheckoutStatus(subscriptionId: string): Promise<CheckoutStatus> {
  const auth = await readSessionAuth()
  if (!auth) return { state: "failed", error: "Your session ended. Sign in again." }

  const snap = await getAdminDb().doc(platformCheckoutDocPath(subscriptionId)).get()
  const doc = snap.data()
  if (!doc || doc.uid !== auth.uid) return { state: "failed", error: "Checkout not found." }

  if (typeof doc.organizationId === "string") {
    return { state: "ready", organizationId: doc.organizationId }
  }
  if (doc.status === "halted" || doc.status === "cancelled") {
    return { state: "failed", error: "The payment didn't go through. You haven't been charged." }
  }
  return { state: "pending" }
}

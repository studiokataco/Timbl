"use server"

import { FieldValue } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/firebase/admin"
import { getCurrentOrgId, getCurrentUser } from "@/lib/auth/server-helpers"
import { orgPath } from "@/lib/firebase/paths"
import { platformBillingDocPath } from "@/lib/platform/schema"
import {
  getRazorpay,
  razorpayKeyId,
  razorpayPlanIdFor,
  isBillablePlan,
} from "@/lib/billing/razorpay"
import { billingSelfServeEnabled } from "@/lib/billing/self-serve"
import { getPlan, TRIAL_DAYS, TRIAL_PLAN_ID } from "@/lib/plans/plans"
import { billingProfileSchema, type BillingProfile } from "@/lib/schemas/billing"

/*
 * Tenant-facing subscription actions (Razorpay). Distinct from
 * lib/actions/platform/billing.ts, which is the platform admin's MANUAL
 * billing-profile editor. These run as the signed-in tenant (scoped by
 * getCurrentOrgId) and drive the self-serve checkout / manage flow.
 *
 * The org's plan is the gating source of truth (/organizations/{id}.plan); it
 * is only advanced by the webhook (H4) on `subscription.activated`, never
 * optimistically here - a created-but-unpaid subscription must not unlock the
 * tier. These actions create/cancel/change the Razorpay subscription and
 * record its id + status on the platform billing doc (via Admin SDK, which
 * bypasses the platform-only rule on that doc).
 *
 * Razorpay subscriptions need a finite billing-cycle count; 120 monthly cycles
 * (~10y) stands in for "until cancelled".
 */

const BILLING_CYCLES = 120

const BILLING_OFF_MSG = "Billing is not available yet"

function billingSelfServeOff(): { ok: false; error: string } | null {
  if (billingSelfServeEnabled()) return null
  return { ok: false, error: BILLING_OFF_MSG }
}

export type CreateSubscriptionResult =
  | { ok: true; subscriptionId: string; keyId: string; shortUrl: string | null }
  | { ok: false; error: string }

export type BillingActionResult = { ok: true } | { ok: false; error: string }

export type SubscriptionStatus = {
  planId: string
  planLabel: string
  status: BillingProfile["status"]
  razorpaySubscriptionId: string | null
  razorpaySubscriptionStatus: string | null
  trialEndsAt: string | null
  trialDaysLeft: number | null
  trialEligible: boolean
  /* Plan the customer picked on /pricing before their invite was approved -
   * stamped on the org doc at approval, cleared once acted on. */
  pendingPlanId: string | null
}

async function readBillingProfile(orgId: string): Promise<BillingProfile | null> {
  const snap = await getAdminDb().doc(platformBillingDocPath(orgId)).get()
  if (!snap.exists) return null
  const parsed = billingProfileSchema.safeParse(snap.data())
  return parsed.success ? parsed.data : null
}

async function patchBillingProfile(orgId: string, patch: Partial<BillingProfile>): Promise<void> {
  await getAdminDb()
    .doc(platformBillingDocPath(orgId))
    .set({ ...patch, updatedAt: new Date().toISOString() }, { merge: true })
}

/* Start a subscription for `planId`. Returns the ids Razorpay Checkout needs.
 * Does NOT change the org's plan - that waits for the webhook. */
export async function createSubscription(planId: string): Promise<CreateSubscriptionResult> {
  const off = billingSelfServeOff()
  if (off) return off

  const orgId = await getCurrentOrgId()
  const user = await getCurrentUser()

  if (!isBillablePlan(planId)) {
    return { ok: false, error: "Plan is not self-serve billable" }
  }
  const razorpayPlanId = razorpayPlanIdFor(planId)
  if (!razorpayPlanId) {
    return { ok: false, error: `No Razorpay plan mapped for ${planId} (run seed:razorpay)` }
  }

  try {
    const sub = await getRazorpay().subscriptions.create({
      plan_id: razorpayPlanId,
      total_count: BILLING_CYCLES,
      quantity: 1,
      customer_notify: 1,
      notes: { orgId, planId },
    })

    await patchBillingProfile(orgId, {
      razorpayPlanId,
      razorpaySubscriptionId: sub.id,
      razorpaySubscriptionStatus: sub.status,
      billingEmail: user.email,
    })

    return {
      ok: true,
      subscriptionId: sub.id,
      keyId: razorpayKeyId(),
      shortUrl: (sub.short_url as string | undefined) ?? null,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Razorpay error" }
  }
}

/* Cancel at the end of the current billing cycle (no mid-cycle refund). The
 * webhook downgrades the plan when Razorpay emits subscription.cancelled. */
export async function cancelSubscription(): Promise<BillingActionResult> {
  const off = billingSelfServeOff()
  if (off) return off

  const orgId = await getCurrentOrgId()
  const profile = await readBillingProfile(orgId)
  const subId = profile?.razorpaySubscriptionId
  if (!subId) return { ok: false, error: "No active subscription" }

  try {
    /* cancel(subscriptionId, cancelAtCycleEnd) - positional flag; the SDK's
     * callback overload widens the return to `& void`, so narrow it. */
    const sub = (await getRazorpay().subscriptions.cancel(subId, true)) as { status: string }
    await patchBillingProfile(orgId, { razorpaySubscriptionStatus: sub.status })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Razorpay error" }
  }
}

/* Move to a different plan. Upgrade applies immediately (prorated by Razorpay);
 * downgrade applies at the next cycle so the customer keeps what they paid for.
 * Plan still flips on the webhook, not here. */
export async function changePlan(
  planId: string,
  meta?: { reason?: string; note?: string },
): Promise<BillingActionResult> {
  const off = billingSelfServeOff()
  if (off) return off

  const orgId = await getCurrentOrgId()
  const user = await getCurrentUser()

  if (!isBillablePlan(planId)) return { ok: false, error: "Plan is not self-serve billable" }
  const razorpayPlanId = razorpayPlanIdFor(planId)
  if (!razorpayPlanId) return { ok: false, error: `No Razorpay plan mapped for ${planId}` }

  const profile = await readBillingProfile(orgId)
  const subId = profile?.razorpaySubscriptionId
  if (!subId) {
    return { ok: false, error: "No active subscription - use createSubscription" }
  }

  const currentPlanId = (await getAdminDb().doc(orgPath(orgId)).get()).data()?.plan as
    | string
    | undefined
  const isUpgrade =
    (getPlan(planId).monthlyPriceInr ?? 0) > (getPlan(currentPlanId).monthlyPriceInr ?? 0)

  try {
    const sub = await getRazorpay().subscriptions.update(subId, {
      plan_id: razorpayPlanId,
      schedule_change_at: isUpgrade ? "now" : "cycle_end",
      customer_notify: 1,
    })
    await patchBillingProfile(orgId, {
      razorpayPlanId,
      razorpaySubscriptionStatus: sub.status,
      billingEmail: user.email,
    })
    /* Append-only log of why a customer downgraded - feeds retention
     * analysis. Only recorded on downgrades, where the reason is collected. */
    if (!isUpgrade && meta?.reason) {
      await getAdminDb()
        .collection(`${orgPath(orgId)}/billingEvents`)
        .add({
          type: "downgrade",
          fromPlan: currentPlanId ?? null,
          toPlan: planId,
          reason: meta.reason,
          note: meta.note ?? null,
          userId: user.id,
          createdAt: FieldValue.serverTimestamp(),
        })
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Razorpay error" }
  }
}

/* Start the 30-day no-card trial: grant the trial tier now, revert to Free at
 * trialEndsAt (enforced lazily in lib/plans/gate.ts). One per org - guarded by
 * trialStartedAt - and not offered to an org that already has a subscription. */
export async function startTrial(): Promise<BillingActionResult> {
  const off = billingSelfServeOff()
  if (off) return off

  const orgId = await getCurrentOrgId()
  const ref = getAdminDb().doc(orgPath(orgId))
  const data = (await ref.get()).data()
  if (data?.trialStartedAt) return { ok: false, error: "Trial already used" }

  const profile = await readBillingProfile(orgId)
  if (profile?.razorpaySubscriptionId) {
    return { ok: false, error: "You already have a subscription" }
  }

  const now = new Date()
  const ends = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
  await ref.set(
    {
      plan: TRIAL_PLAN_ID,
      billingStatus: "trialing",
      trialStartedAt: now.toISOString(),
      trialEndsAt: ends.toISOString(),
    },
    { merge: true },
  )
  return { ok: true }
}

/* Read-only status for the tenant billing page. Reads the org doc once -
 * billingStatus + trial fields live there; the subscription id lives on the
 * platform billing profile. */
export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  const orgId = await getCurrentOrgId()
  const orgData = (await getAdminDb().doc(orgPath(orgId)).get()).data()
  const plan = getPlan(orgData?.plan as string | undefined)
  const profile = await readBillingProfile(orgId)

  const status =
    (orgData?.billingStatus as BillingProfile["status"] | undefined) ??
    profile?.status ??
    "manual"
  const trialEndsAt = (orgData?.trialEndsAt as string | undefined) ?? null
  const hasSub = Boolean(profile?.razorpaySubscriptionId)
  const trialDaysLeft =
    status === "trialing" && trialEndsAt
      ? Math.max(0, Math.ceil((Date.parse(trialEndsAt) - Date.now()) / 86_400_000))
      : null

  return {
    planId: plan.id,
    planLabel: plan.label,
    status,
    razorpaySubscriptionId: profile?.razorpaySubscriptionId ?? null,
    razorpaySubscriptionStatus: profile?.razorpaySubscriptionStatus ?? null,
    trialEndsAt,
    trialDaysLeft,
    trialEligible: !orgData?.trialStartedAt && !hasSub && status !== "trialing",
    pendingPlanId: (orgData?.pendingPlan as string | undefined) ?? null,
  }
}

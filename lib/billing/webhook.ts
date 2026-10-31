import "server-only"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgPath } from "@/lib/firebase/paths"
import { provisionPaidWorkspace } from "@/lib/auth/membership"
import { platformBillingDocPath, platformCheckoutDocPath } from "@/lib/platform/schema"
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

  const planId = sub.notes?.planId
  const db = getAdminDb()

  let orgId = sub.notes?.orgId
  if (!orgId && sub.notes?.intent === "new_workspace") {
    orgId = await resolveCheckoutOrg(sub, decision.planTarget === "paid")
    if (!orgId) return { handled: true, note: `${evt.event} on checkout ${sub.id}, no workspace yet` }
  }
  if (!orgId) return { handled: false, note: `no orgId in notes on ${sub.id}` }

  /* Stamp billingStatus on the org doc (the gate + dunning banner read it from
   * here, alongside plan, in a single get) and change the plan when the event
   * implies a tier move. */
  const orgRef = db.doc(orgPath(orgId))
  /* A subscription abandoned at checkout still fires cancelled/expired. Only
   * let non-activating events touch an org that is on the tier this
   * subscription sold, so a manual or other-tier plan is never downgraded. */
  const governsOrg =
    decision.planTarget === "paid" ||
    ((await orgRef.get()).data()?.plan as string | undefined) === planId
  if (governsOrg) {
    const orgPatch: Record<string, unknown> = { billingStatus: decision.status }
    if (decision.planTarget === "paid" && planId) orgPatch.plan = planId
    else if (decision.planTarget === "free") orgPatch.plan = FREE_PLAN_ID
    await orgRef.set(orgPatch, { merge: true })
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

const PROVISION_LOCK_MS = 2 * 60_000

/* Public checkout subscriptions carry the buyer, not an org. The first
 * activating event creates the workspace and records it on the checkout doc;
 * later events reuse it. A concurrent event (activated and charged land
 * together) throws while the lock is held, so the route 500s and Razorpay
 * retries once the workspace exists. */
async function resolveCheckoutOrg(sub: SubEntity, activating: boolean): Promise<string | undefined> {
  const db = getAdminDb()
  const ref = db.doc(platformCheckoutDocPath(sub.id))
  const now = Date.now()

  const claim = await db.runTransaction(async (tx) => {
    const doc = (await tx.get(ref)).data() ?? {}
    if (typeof doc.organizationId === "string") return { orgId: doc.organizationId as string }
    tx.set(ref, { status: sub.status, updatedAt: new Date(now).toISOString() }, { merge: true })
    if (!activating) return { orgId: undefined }
    const lockedAt = typeof doc.provisioningAt === "number" ? doc.provisioningAt : 0
    if (now - lockedAt < PROVISION_LOCK_MS) return { busy: true as const }
    tx.set(ref, { provisioningAt: now }, { merge: true })
    return { provision: true as const }
  })

  if ("orgId" in claim) return claim.orgId
  if ("busy" in claim) throw new Error(`workspace for ${sub.id} is still being created`)

  const email = sub.notes?.buyerEmail
  if (!email) throw new Error(`checkout ${sub.id} has no buyer email`)
  const claims = await provisionPaidWorkspace({ email })
  await ref.set(
    { organizationId: claims.organizationId, provisioningAt: null, updatedAt: new Date().toISOString() },
    { merge: true },
  )
  return claims.organizationId
}

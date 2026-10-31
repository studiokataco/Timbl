import { getAdminDb } from "@/lib/firebase/admin"
import { orgPath } from "@/lib/firebase/paths"
import { applyRazorpayEvent } from "@/lib/billing/webhook"
import { getOrgPlanFeatures } from "@/lib/plans/gate"
import { FREE_PLAN_ID, TRIAL_PLAN_ID } from "@/lib/plans/plans"

/*
 * Billing smoke test against the emulator. Exercises the webhook event ->
 * plan logic and the trial lifecycle end to end without Razorpay or a browser.
 *
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 pnpm verify:billing
 */

const ORG = "_billing_smoke_test"

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
  console.log(`  ok - ${msg}`)
}

function event(name: string, planId?: string) {
  return {
    event: name,
    payload: {
      subscription: {
        entity: {
          id: "sub_smoke",
          status: name.split(".")[1],
          notes: { orgId: ORG, ...(planId ? { planId } : {}) },
        },
      },
    },
  }
}

async function planOf(): Promise<string> {
  return (await getOrgPlanFeatures(ORG)).planId
}

async function main() {
  const db = getAdminDb()
  const ref = db.doc(orgPath(ORG))
  await ref.set({ name: "Billing smoke test", plan: FREE_PLAN_ID })

  console.log("1. webhook subscription.activated -> paid tier")
  await applyRazorpayEvent(event("subscription.activated", "studio_v1"))
  assert((await planOf()) === "studio_v1", "activated set plan to studio_v1")
  assert((await ref.get()).data()?.billingStatus === "active", "billingStatus active")

  console.log("2. webhook subscription.charged -> stays paid (renewal)")
  await applyRazorpayEvent(event("subscription.charged", "studio_v1"))
  assert((await planOf()) === "studio_v1", "charged keeps studio_v1")

  console.log("3. webhook subscription.halted -> past_due, plan unchanged")
  await applyRazorpayEvent(event("subscription.halted", "studio_v1"))
  assert((await ref.get()).data()?.billingStatus === "past_due", "halted -> past_due")
  assert((await planOf()) === "studio_v1", "halted keeps tier (dunning, not downgrade)")

  console.log("4. webhook subscription.cancelled -> revert to Free")
  await applyRazorpayEvent(event("subscription.cancelled", "studio_v1"))
  assert((await planOf()) === FREE_PLAN_ID, "cancelled reverts to free")
  assert((await ref.get()).data()?.billingStatus === "canceled", "billingStatus canceled")

  console.log("5. trial active -> Agency features")
  const future = new Date(Date.now() + 5 * 86_400_000).toISOString()
  await ref.set(
    { plan: TRIAL_PLAN_ID, billingStatus: "trialing", trialEndsAt: future },
    { merge: true },
  )
  assert((await planOf()) === TRIAL_PLAN_ID, "active trial grants trial tier")

  console.log("6. trial expired -> lazy revert to Free + persisted")
  const past = new Date(Date.now() - 86_400_000).toISOString()
  await ref.set({ billingStatus: "trialing", trialEndsAt: past }, { merge: true })
  assert((await planOf()) === FREE_PLAN_ID, "expired trial reads as free")
  const after = (await ref.get()).data()
  assert(after?.plan === FREE_PLAN_ID, "expiry persisted plan=free to the doc")
  assert(after?.billingStatus === "canceled", "expiry persisted billingStatus=canceled")

  console.log("7. abandoned checkout cancelled -> manual plan untouched")
  await ref.set({ plan: "agency_v1", billingStatus: "manual" }, { merge: true })
  await applyRazorpayEvent(event("subscription.cancelled", "studio_v1"))
  const manual = (await ref.get()).data()
  assert(manual?.plan === "agency_v1", "manual Agency plan kept")
  assert(manual?.billingStatus === "manual", "manual billingStatus kept")

  await ref.delete()
  console.log("\nAll billing checks passed.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

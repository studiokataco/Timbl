import Razorpay from "razorpay"

import { PLANS } from "@/lib/plans/plans"

/*
 * Create one Razorpay Plan per billable tier (Studio, Agency) from the INR
 * prices in lib/plans/plans.ts, then print the env lines to paste into
 * .env.local (and App Hosting secrets) so the app can map plan id -> Razorpay
 * plan id.
 *
 *   RAZORPAY_KEY_ID=rzp_test_xxx RAZORPAY_KEY_SECRET=xxx \
 *   pnpm seed:razorpay
 *
 * NOT idempotent on Razorpay's side - it creates a NEW plan each run. To avoid
 * duplicates, it SKIPS any tier whose RAZORPAY_PLAN_<TIER> env var is already
 * set. Run once per environment (test, then live), capture the ids, done.
 *
 * Free is not billable (no plan); Scale is custom/manual (no self-serve plan).
 */

const ENV_BY_PLAN: Record<string, string> = {
  studio_v1: "RAZORPAY_PLAN_STUDIO_V1",
  agency_v1: "RAZORPAY_PLAN_AGENCY_V1",
}

async function main() {
  const key_id = process.env.RAZORPAY_KEY_ID
  const key_secret = process.env.RAZORPAY_KEY_SECRET
  if (!key_id || !key_secret) {
    throw new Error("Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the environment")
  }
  const rzp = new Razorpay({ key_id, key_secret })
  const mode = key_id.startsWith("rzp_live") ? "LIVE" : "TEST"
  console.log(`Seeding Razorpay plans (${mode} mode)\n`)

  const out: string[] = []
  for (const [planId, envName] of Object.entries(ENV_BY_PLAN)) {
    const plan = PLANS[planId]
    if (!plan || !plan.monthlyPriceInr) {
      console.log(`- ${planId}: not billable, skipped`)
      continue
    }
    if (process.env[envName]) {
      console.log(`- ${planId}: ${envName} already set (${process.env[envName]}), skipped`)
      out.push(`${envName}=${process.env[envName]}`)
      continue
    }

    const created = await rzp.plans.create({
      period: "monthly",
      interval: 1,
      item: {
        name: `${plan.label} (monthly)`,
        amount: Math.round(plan.monthlyPriceInr * 100), // paise
        currency: "INR",
        description: `${plan.label} tier - ${planId}`,
      },
      notes: { planId },
    })
    console.log(`- ${planId}: created ${created.id} (Rs ${plan.monthlyPriceInr}/mo)`)
    out.push(`${envName}=${created.id}`)
  }

  console.log("\nPaste into .env.local / App Hosting secrets:\n")
  console.log(out.join("\n"))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

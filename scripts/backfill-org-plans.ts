import { getAdminDb } from "@/lib/firebase/admin"

/*
 * Backfill: stamp an explicit `plan` on every org that lacks one, BEFORE the
 * gate fallback (lib/plans/plans.ts DEFAULT_PLAN_ID) flips from agency_v1 to
 * free_v1. Without this, the flip would silently downgrade any org relying on
 * the old default. Grandfather everyone to agency_v1 - the tier they had
 * implicitly - so the flip is a no-op for existing tenants.
 *
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 pnpm backfill:plans
 *
 * Idempotent: only writes orgs missing `plan`. Run once per environment
 * (emulator, then production with Admin SDK credentials) before/at deploy.
 */

const GRANDFATHER_PLAN_ID = "agency_v1"

async function main() {
  const db = getAdminDb()
  const snap = await db.collection("organizations").get()
  let patched = 0
  let skipped = 0

  for (const doc of snap.docs) {
    const plan = doc.data().plan
    if (typeof plan === "string" && plan.length > 0) {
      skipped++
      continue
    }
    await doc.ref.set({ plan: GRANDFATHER_PLAN_ID }, { merge: true })
    patched++
    console.log(`- ${doc.id}: set plan=${GRANDFATHER_PLAN_ID}`)
  }

  console.log(`\nDone. ${patched} backfilled, ${skipped} already had a plan.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

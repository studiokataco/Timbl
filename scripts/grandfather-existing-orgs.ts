import { getAdminDb } from "@/lib/firebase/admin"

/*
 * Grandfather every org that exists RIGHT NOW to full (Agency) access, comped,
 * "until further notice". Run once after billing goes live so existing users
 * keep everything they had while new signups land on Free/trial.
 *
 *   # emulator
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 pnpm grandfather:existing
 *   # production (Admin SDK creds, NO emulator host)
 *   FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON='<prod sa json>' pnpm grandfather:existing
 *
 * Sets plan=agency_v1, billingStatus=manual (so trial-expiry/dunning never
 * touch them), and a `grandfathered` flag + timestamp so this exact cohort can
 * be re-targeted later. Idempotent: skips orgs already flagged, so orgs created
 * AFTER this run are not swept in.
 */

const GRANDFATHER_PLAN_ID = "agency_v1"

async function main() {
  const onEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
  const dryRun = process.env.DRY_RUN === "1"
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "timbl-dev"
  const target = onEmulator ? `EMULATOR (${projectId})` : `PRODUCTION (${projectId})`
  console.log(`Grandfather existing orgs -> ${target}${dryRun ? " [DRY RUN]" : ""}\n`)

  /* Write-guard: a live (non-emulator) write must name the exact project via
   * GRANDFATHER_CONFIRM so it can never fire against the wrong database by
   * accident. Dry runs and emulator runs are exempt (read-only / disposable). */
  if (!onEmulator && !dryRun && process.env.GRANDFATHER_CONFIRM !== projectId) {
    throw new Error(
      `Refusing live write. Re-run with GRANDFATHER_CONFIRM=${projectId} to confirm the target.`,
    )
  }

  const db = getAdminDb()
  const snap = await db.collection("organizations").get()
  const now = new Date().toISOString()
  let done = 0
  let already = 0

  for (const doc of snap.docs) {
    if (doc.data().grandfathered === true) {
      already++
      continue
    }
    if (dryRun) {
      done++
      console.log(`- ${doc.id} (${doc.data().name ?? "?"}): would grant ${GRANDFATHER_PLAN_ID}`)
      continue
    }
    await doc.ref.set(
      {
        plan: GRANDFATHER_PLAN_ID,
        billingStatus: "manual",
        grandfathered: true,
        grandfatheredAt: now,
      },
      { merge: true },
    )
    done++
    console.log(`- ${doc.id}: full access (${GRANDFATHER_PLAN_ID})`)
  }

  const verb = dryRun ? "would be grandfathered" : "grandfathered"
  console.log(`\nDone. ${done} ${verb}, ${already} already grandfathered.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

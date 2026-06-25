#!/usr/bin/env tsx
/*
 * Enable realtime GA: global default ON + clear per-org blocks.
 * Optionally pins realtime_v1 on the canary org (timbl-demo).
 *
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID=timbl-prod \
 *   GOOGLE_CLOUD_PROJECT=timbl-prod \
 *   GCP_PROJECT=timbl-prod \
 *   REALTIME_CONFIRM=timbl-prod \
 *   pnpm tsx --require ./scripts/stub-server-only.cjs scripts/enable-realtime-all-orgs.ts
 *
 * Dry run (read-only):
 *   DRY_RUN=1 ... (same env, omit REALTIME_CONFIRM)
 */
import { getAdminDb } from "@/lib/firebase/admin"
import { orgPath } from "@/lib/firebase/paths"
import { TIMBL_DEMO_ORG_ID } from "@/lib/constants/timbl"
import { platformConfigDocPath } from "@/lib/platform/schema"

const CANARY_ORG_ID = TIMBL_DEMO_ORG_ID

async function main() {
  const onEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
  const dryRun = process.env.DRY_RUN === "1"
  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
    process.env.GCP_PROJECT ??
    "timbl-dev"
  const target = onEmulator ? `EMULATOR (${projectId})` : `PRODUCTION (${projectId})`
  console.log(`Enable realtime GA -> ${target}${dryRun ? " [DRY RUN]" : ""}\n`)

  if (!onEmulator && !dryRun && process.env.REALTIME_CONFIRM !== projectId) {
    throw new Error(
      `Refusing live write. Re-run with REALTIME_CONFIRM=${projectId} to confirm.`,
    )
  }

  const db = getAdminDb()
  const now = new Date().toISOString()

  const configRef = db.doc(platformConfigDocPath)
  const configBefore = (await configRef.get()).data()
  console.log(
    `platform/config realtimeDefault: ${configBefore?.realtimeDefault ?? "(unset)"} -> true`,
  )
  if (!dryRun) {
    await configRef.set({ realtimeDefault: true, updatedAt: now }, { merge: true })
  }

  const canaryRef = db.doc(orgPath(CANARY_ORG_ID))
  if ((await canaryRef.get()).exists) {
    console.log(`${CANARY_ORG_ID}: realtime_v1 -> true (canary pin)`)
    if (!dryRun) {
      await canaryRef.set(
        { featureFlags: { realtime_v1: true }, updatedAt: now },
        { merge: true },
      )
    }
  } else {
    console.log(`${CANARY_ORG_ID}: org not found (skip canary pin)`)
  }

  const orgSnap = await db.collection("organizations").get()
  let cleared = 0
  let alreadyOk = 0

  for (const doc of orgSnap.docs) {
    const flags = (doc.data().featureFlags ?? {}) as Record<string, boolean>
    if (flags.realtime_v1 === false) {
      cleared++
      console.log(`${doc.id}: clearing realtime_v1:false block`)
      if (!dryRun) {
        await doc.ref.set(
          { featureFlags: { realtime_v1: true }, updatedAt: now },
          { merge: true },
        )
      }
    } else {
      alreadyOk++
    }
  }

  console.log(
    `\nDone. Global default ON. ${cleared} org block(s) cleared, ${alreadyOk} org(s) already OK.`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

import { getAdminDb } from "@/lib/firebase/admin"

/*
 * Migration 0013 - grant the `drafter` agent the `createTemplate` tool.
 *
 * Why a migration: lib/agents/defaults.ts is the source of truth only for
 * NEW installs - installDefaultAgents() skips agentConfigs that already
 * exist. Existing orgs' drafter docs keep their stored allowedTools, so the
 * permission callback rejects createTemplate until this backfill runs.
 *
 * Standalone - NOT wired into firestore/seeds/run.ts. Idempotent: unions the
 * tool into allowedTools, so a second run reports everything already granted.
 *
 * Target detection:
 *   - FIRESTORE_EMULATOR_HOST set → the emulator (safe; dev default).
 *   - otherwise                  → the real Firebase project (PRODUCTION),
 *     which requires CONFIRM_PROD_MIGRATION=1 so it cannot fire by accident.
 */

const AGENT = "drafter"
const TOOL = "createTemplate"

export async function migrate0013DrafterCreateTemplate(): Promise<void> {
  const emulator = process.env.FIRESTORE_EMULATOR_HOST
  if (!emulator && process.env.CONFIRM_PROD_MIGRATION !== "1") {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST is not set - this run would write to " +
        "PRODUCTION Firestore. Re-run with CONFIRM_PROD_MIGRATION=1 if that " +
        "is intended.",
    )
  }
  console.log(
    emulator
      ? `→ migration 0013 against emulator @ ${emulator}`
      : "→ migration 0013 against PRODUCTION Firestore",
  )

  const db = getAdminDb()
  const orgs = await db.collection("organizations").get()
  let updated = 0
  let alreadyGranted = 0
  let noDrafter = 0

  for (const org of orgs.docs) {
    const ref = db.doc(`organizations/${org.id}/agentConfigs/${AGENT}`)
    const snap = await ref.get()
    if (!snap.exists) {
      noDrafter++
      continue
    }
    const tools: string[] = Array.isArray(snap.data()?.allowedTools)
      ? snap.data()!.allowedTools
      : []
    if (tools.includes(TOOL)) {
      alreadyGranted++
      continue
    }
    await ref.set(
      { allowedTools: [...tools, TOOL], updatedAt: new Date().toISOString() },
      { merge: true },
    )
    console.log(`  ${org.id}/${AGENT}: +${TOOL}`)
    updated++
  }

  console.log(
    `✓ migration 0013: ${updated} updated, ${alreadyGranted} already had ` +
      `${TOOL}, ${noDrafter} orgs without a drafter`,
  )
}

if (require.main === module) {
  migrate0013DrafterCreateTemplate().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

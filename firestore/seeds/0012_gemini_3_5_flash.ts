import { getAdminDb } from "@/lib/firebase/admin"

/*
 * Migration 0012 - swap every `gemini`-provider agentConfig to Gemini 3.5
 * Flash (`gemini-3.5-flash`, GA, released 2026-05-19).
 *
 * Why a migration: lib/agents/defaults.ts is the source of truth only for
 * NEW installs - installDefaultAgents() skips agentConfigs that already
 * exist. Existing orgs' agents keep whatever model is on their Firestore
 * doc, so they need this explicit update.
 *
 * Standalone - NOT wired into firestore/seeds/run.ts. Idempotent: a second
 * run reports everything already on target. `anthropic` agents (drafter)
 * are deliberately left untouched.
 *
 * Target detection:
 *   - FIRESTORE_EMULATOR_HOST set → the emulator (safe; dev default).
 *   - otherwise                  → the real Firebase project (PRODUCTION),
 *     which requires CONFIRM_PROD_MIGRATION=1 so it cannot fire by accident.
 *
 * ⚠️ Before running against prod, confirm `gemini-3.5-flash` is the live
 * API model ID (GET /v1beta/models). A wrong ID makes every Gemini agent
 * fail; re-running this with the corrected string is the rollback.
 */

const TARGET_MODEL = "gemini-3.5-flash"

export async function migrate0012GeminiFlash(): Promise<void> {
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
      ? `→ migration 0012 against emulator @ ${emulator}`
      : "→ migration 0012 against PRODUCTION Firestore",
  )

  const db = getAdminDb()
  const orgs = await db.collection("organizations").get()
  let updated = 0
  let alreadyOnTarget = 0
  let nonGemini = 0

  for (const org of orgs.docs) {
    const cfgs = await db
      .collection(`organizations/${org.id}/agentConfigs`)
      .get()
    for (const c of cfgs.docs) {
      const data = c.data()
      if (data?.provider !== "gemini") {
        nonGemini++
        continue
      }
      if (data?.model === TARGET_MODEL) {
        alreadyOnTarget++
        continue
      }
      await c.ref.set(
        { model: TARGET_MODEL, updatedAt: new Date().toISOString() },
        { merge: true },
      )
      console.log(
        `  ${org.id}/${c.id}: ${data?.model ?? "(unset)"} → ${TARGET_MODEL}`,
      )
      updated++
    }
  }

  console.log(
    `✓ migration 0012: ${updated} updated, ${alreadyOnTarget} already on ` +
      `${TARGET_MODEL}, ${nonGemini} non-gemini left untouched`,
  )
}

if (require.main === module) {
  migrate0012GeminiFlash().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

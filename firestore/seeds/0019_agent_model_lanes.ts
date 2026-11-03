import { getAdminApp, getAdminDb } from "@/lib/firebase/admin"
import { AGENT_DEFAULTS } from "@/lib/agents/defaults"
import { TIMBL_FIREBASE_PROJECT_PROD } from "@/lib/constants/timbl"

/* Migration 0019 - move existing orgs onto the defaults.ts model lanes.
 * Only agents still on a retired default move; hand-picked models are kept. */

const RETIRED_DEFAULTS = new Set([
  "google/gemini-3.1-flash-lite",
  "minimax/minimax-m3",
  "anthropic/claude-haiku-4.5",
])

export async function migrate0019AgentModelLanes(): Promise<void> {
  const emulator = process.env.FIRESTORE_EMULATOR_HOST
  if (!emulator && process.env.CONFIRM_PROD_MIGRATION !== "1") {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST is not set - this run would write to a real " +
        "Firestore. Re-run with CONFIRM_PROD_MIGRATION=1 if that is intended.",
    )
  }

  const projectId = getAdminApp().options.projectId
  if (!emulator) {
    const expected = process.env.EXPECT_PROJECT_ID
    if (!expected) {
      throw new Error(
        `Resolved Firestore project is "${projectId}". Re-run with ` +
          `EXPECT_PROJECT_ID=${projectId} to confirm (production is ` +
          `${TIMBL_FIREBASE_PROJECT_PROD}).`,
      )
    }
    if (expected !== projectId) {
      throw new Error(
        `EXPECT_PROJECT_ID="${expected}" but the Admin SDK resolved ` +
          `"${projectId}". Set NEXT_PUBLIC_FIREBASE_PROJECT_ID=${expected} and retry.`,
      )
    }
  }

  console.log(
    emulator
      ? `→ migration 0019 against emulator @ ${emulator} (project ${projectId})`
      : `→ migration 0019 against REAL Firestore project ${projectId}`,
  )

  const db = getAdminDb()
  const orgs = await db.collection("organizations").get()
  let moved = 0
  let already = 0
  let skipped = 0

  for (const org of orgs.docs) {
    for (const def of AGENT_DEFAULTS) {
      if (def.provider !== "openrouter") continue
      const ref = db.doc(`organizations/${org.id}/agentConfigs/${def.name}`)
      const snap = await ref.get()
      if (!snap.exists) continue
      const data = snap.data()

      const onTarget =
        data?.provider === def.provider && data?.model === def.model
      if (onTarget && data?.reasoningEffort === def.reasoningEffort) {
        already++
        continue
      }
      const onRetired =
        data?.provider === "openrouter" && RETIRED_DEFAULTS.has(data?.model)
      if (!onTarget && !onRetired) {
        console.log(
          `  skip ${org.id}/${def.name}: custom ${data?.provider}/${data?.model}`,
        )
        skipped++
        continue
      }

      await ref.set(
        {
          model: def.model,
          reasoningEffort: def.reasoningEffort,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      )
      console.log(
        `  ${org.id}/${def.name}: ${data?.model} → ${def.model} (${def.reasoningEffort ?? "model default"})`,
      )
      moved++
    }
  }

  console.log(
    `✓ migration 0019: ${moved} updated, ${already} already on target, ${skipped} custom models left alone`,
  )
}

if (require.main === module) {
  migrate0019AgentModelLanes().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

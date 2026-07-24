import { getAdminApp, getAdminDb } from "@/lib/firebase/admin"
import { getAgentDefault } from "@/lib/agents/defaults"
import { TIMBL_FIREBASE_PROJECT_PROD } from "@/lib/constants/timbl"

/*
 * Migration 0018 - sync existing orgs' awareness-researcher model to its
 * defaults.ts value (google/gemini-3.1-flash-lite / OR_CHEAP).
 *
 * Why: migration 0017 moved awareness-researcher to OpenRouter on the
 * OR_WORKHORSE model (minimax/minimax-m3). A head-to-head accuracy test then
 * showed minimax-m3 completes the run but writes ZERO proposals on this
 * grounded-discovery task, while gemini-3.1-flash-lite returns accurate,
 * well-sourced days. defaults.ts now pins awareness-researcher to OR_CHEAP;
 * this brings existing orgs in line. Provider stays openrouter.
 *
 * Model comes from getAgentDefault() so this file never hard-codes a value
 * that could drift from defaults.ts. Standalone, idempotent, same dual
 * project guard as 0016/0017.
 */

const AGENT = "awareness-researcher"

export async function migrate0018AwarenessFlashLite(): Promise<void> {
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
      ? `→ migration 0018 against emulator @ ${emulator} (project ${projectId})`
      : `→ migration 0018 against REAL Firestore project ${projectId}`,
  )

  const target = getAgentDefault(AGENT)
  if (!target || target.provider !== "openrouter") {
    throw new Error(
      `defaults.ts default for ${AGENT} is ${target ? target.provider : "missing"}, ` +
        "expected openrouter - aborting.",
    )
  }

  const db = getAdminDb()
  const orgs = await db.collection("organizations").get()
  let moved = 0
  let already = 0
  let absent = 0

  for (const org of orgs.docs) {
    const ref = db.doc(`organizations/${org.id}/agentConfigs/${AGENT}`)
    const snap = await ref.get()
    if (!snap.exists) {
      absent++
      continue
    }
    const data = snap.data()
    if (data?.provider === target.provider && data?.model === target.model) {
      already++
      continue
    }
    await ref.set(
      {
        provider: target.provider,
        model: target.model,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    )
    console.log(
      `  ${org.id}/${AGENT}: ${data?.provider}/${data?.model ?? "(unset)"} → ${target.provider}/${target.model}`,
    )
    moved++
  }

  console.log(
    `✓ migration 0018: ${moved} updated to ${target.model}, ${already} already on target, ${absent} orgs without the agent`,
  )
}

if (require.main === module) {
  migrate0018AwarenessFlashLite().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

import { getAdminApp, getAdminDb } from "@/lib/firebase/admin"
import { getAgentDefault } from "@/lib/agents/defaults"
import { TIMBL_FIREBASE_PROJECT_PROD } from "@/lib/constants/timbl"

/*
 * Migration 0016 - move `gemini`-provider agentConfigs onto OpenRouter,
 * back in line with lib/agents/defaults.ts.
 *
 * Why: migration 0012 pinned every existing org's Gemini agents to
 * gemini-3.5-flash, while the code defaults had already moved to OpenRouter.
 * Only NEW installs picked that up (installDefaultAgents skips existing
 * docs), so long-lived orgs kept routing to Gemini and shared one quota pool
 * with the embeddings pipeline - the cause of the 429 RESOURCE_EXHAUSTED
 * agent-run failures.
 *
 * Exclusions:
 *   - `awareness-researcher` stays on Gemini. It grounds through the
 *     first-party GOOGLE_SEARCH + URL_CONTEXT server tools, and swapping it
 *     to OpenRouter's web-search plugin is a grounding-quality decision, not
 *     an infra one. Revisit after a side-by-side.
 *   - Any agent whose default is not `openrouter`, or which has no entry in
 *     AGENT_DEFAULTS (a custom agent) - reported, never guessed at.
 *
 * Target provider AND model both come from getAgentDefault(), so this file
 * never becomes a second source of truth that drifts from defaults.ts.
 *
 * Standalone - NOT wired into firestore/seeds/run.ts. Idempotent.
 *
 * Target detection:
 *   - FIRESTORE_EMULATOR_HOST set → the emulator (safe; dev default).
 *   - otherwise                  → the real Firebase project (PRODUCTION),
 *     which requires CONFIRM_PROD_MIGRATION=1 so it cannot fire by accident.
 */

const KEEP_ON_GEMINI = new Set(["awareness-researcher"])

export async function migrate0016GeminiOffload(): Promise<void> {
  const emulator = process.env.FIRESTORE_EMULATOR_HOST
  if (!emulator && process.env.CONFIRM_PROD_MIGRATION !== "1") {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST is not set - this run would write to a real " +
        "Firestore. Re-run with CONFIRM_PROD_MIGRATION=1 if that is intended.",
    )
  }

  /* The emulator-host check alone is not enough: off-emulator the Admin SDK
   * resolves its project from NEXT_PUBLIC_FIREBASE_PROJECT_ID and silently
   * falls back to the DEV project, so a "prod" run can land on timbl-dev.
   * Resolve the project the SDK actually connected to and make the operator
   * name it. */
  const projectId = getAdminApp().options.projectId
  if (!emulator) {
    const expected = process.env.EXPECT_PROJECT_ID
    if (!expected) {
      throw new Error(
        `Resolved Firestore project is "${projectId}". Re-run with ` +
          `EXPECT_PROJECT_ID=${projectId} to confirm that is the intended ` +
          `target (production is ${TIMBL_FIREBASE_PROJECT_PROD}).`,
      )
    }
    if (expected !== projectId) {
      throw new Error(
        `EXPECT_PROJECT_ID="${expected}" but the Admin SDK resolved ` +
          `"${projectId}". Refusing to run. Set ` +
          `NEXT_PUBLIC_FIREBASE_PROJECT_ID=${expected} and retry.`,
      )
    }
  }

  console.log(
    emulator
      ? `→ migration 0016 against emulator @ ${emulator} (project ${projectId})`
      : `→ migration 0016 against REAL Firestore project ${projectId}`,
  )

  const db = getAdminDb()
  const orgs = await db.collection("organizations").get()
  let moved = 0
  let keptGrounding = 0
  let nonGemini = 0
  const skipped: string[] = []

  for (const org of orgs.docs) {
    const cfgs = await db.collection(`organizations/${org.id}/agentConfigs`).get()
    for (const c of cfgs.docs) {
      const data = c.data()
      if (data?.provider !== "gemini") {
        nonGemini++
        continue
      }
      if (KEEP_ON_GEMINI.has(c.id)) {
        keptGrounding++
        continue
      }

      const target = getAgentDefault(c.id)
      if (!target || target.provider !== "openrouter") {
        skipped.push(`${org.id}/${c.id} (${target ? `default is ${target.provider}` : "no default"})`)
        continue
      }

      await c.ref.set(
        {
          provider: target.provider,
          model: target.model,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      )
      console.log(
        `  ${org.id}/${c.id}: gemini/${data?.model ?? "(unset)"} → ${target.provider}/${target.model}`,
      )
      moved++
    }
  }

  console.log(
    `✓ migration 0016: ${moved} moved to OpenRouter, ${keptGrounding} kept on ` +
      `Gemini for grounding, ${nonGemini} already non-gemini`,
  )
  if (skipped.length) {
    console.log(`  needs manual review (${skipped.length}):`)
    for (const s of skipped) console.log(`    - ${s}`)
  }
}

if (require.main === module) {
  migrate0016GeminiOffload().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

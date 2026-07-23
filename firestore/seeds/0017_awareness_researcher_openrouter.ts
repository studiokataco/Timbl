import { getAdminApp, getAdminDb } from "@/lib/firebase/admin"
import { getAgentDefault } from "@/lib/agents/defaults"
import { TIMBL_FIREBASE_PROJECT_PROD } from "@/lib/constants/timbl"

/*
 * Migration 0017 - move `awareness-researcher` off Gemini onto OpenRouter.
 *
 * Why: on the Gemini path awareness-researcher declares the built-in
 * google_search + url_context tools AND the proposeAwarenessDay function in
 * one request. Gemini rejects that combination
 *   (400: "enable tool_config.include_server_side_tool_invocations to use
 *    Built-in tools with Function calling")
 * so it grounds but never calls the tool - the run "succeeds" and writes
 * zero proposals. OpenRouter's web-search server tool coexists with function
 * calling (verified on OR_WORKHORSE + gemini-3.1-flash-lite), so the fix is
 * to run this agent on OpenRouter like every other workflow agent.
 *
 * Migration 0016 had deliberately KEPT this agent on Gemini for "native
 * grounding"; this reverses that once the grounding path proved broken.
 * lib/agents/defaults.ts already lists awareness-researcher as
 * provider=openrouter, so target provider+model come from getAgentDefault()
 * and this file never becomes a second source of truth.
 *
 * Standalone - NOT wired into firestore/seeds/run.ts. Idempotent. Same
 * dual project guard as 0016.
 */

const AGENT = "awareness-researcher"

export async function migrate0017AwarenessOpenRouter(): Promise<void> {
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
      ? `→ migration 0017 against emulator @ ${emulator} (project ${projectId})`
      : `→ migration 0017 against REAL Firestore project ${projectId}`,
  )

  const target = getAgentDefault(AGENT)
  if (!target || target.provider !== "openrouter") {
    throw new Error(
      `defaults.ts default for ${AGENT} is ${target ? target.provider : "missing"}, ` +
        "expected openrouter - aborting so this migration cannot mis-target.",
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
    if (data?.provider !== "gemini") {
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
      `  ${org.id}/${AGENT}: gemini/${data?.model ?? "(unset)"} → ${target.provider}/${target.model}`,
    )
    moved++
  }

  console.log(
    `✓ migration 0017: ${moved} moved to OpenRouter, ${already} already non-gemini, ${absent} orgs without the agent`,
  )
}

if (require.main === module) {
  migrate0017AwarenessOpenRouter().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

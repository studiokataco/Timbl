import { FieldValue } from "firebase-admin/firestore"

import { getAdminApp, getAdminDb } from "@/lib/firebase/admin"
import { AGENT_DEFAULTS } from "@/lib/agents/defaults"
import { TIMBL_FIREBASE_PROJECT_PROD } from "@/lib/constants/timbl"

/* Migration 0021 - grant recallIntent / rememberIntent to existing orgs for
 * every agent whose default has them. Empty allowedTools means all tools. */

const INTENT_TOOLS = ["recallIntent", "rememberIntent"]

export async function migrate0021IntentTools(): Promise<void> {
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
      ? `→ migration 0021 against emulator @ ${emulator} (project ${projectId})`
      : `→ migration 0021 against REAL Firestore project ${projectId}`,
  )

  const db = getAdminDb()
  const agents = AGENT_DEFAULTS.filter((d) =>
    INTENT_TOOLS.every((t) => d.allowedTools.includes(t)),
  )
  const orgs = await db.collection("organizations").get()
  let granted = 0
  let already = 0

  for (const org of orgs.docs) {
    for (const def of agents) {
      const ref = db.doc(`organizations/${org.id}/agentConfigs/${def.name}`)
      const snap = await ref.get()
      if (!snap.exists) continue
      const tools: string[] = snap.data()?.allowedTools ?? []
      if (tools.length === 0 || INTENT_TOOLS.every((t) => tools.includes(t))) {
        already++
        continue
      }
      await ref.set(
        {
          allowedTools: FieldValue.arrayUnion(...INTENT_TOOLS),
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      )
      console.log(`  ${org.id}/${def.name}: granted intent tools`)
      granted++
    }
  }

  console.log(`✓ migration 0021: ${granted} granted, ${already} already allowed`)
}

if (require.main === module) {
  migrate0021IntentTools().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

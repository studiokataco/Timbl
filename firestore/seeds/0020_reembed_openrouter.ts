import { getAdminApp, getAdminDb } from "@/lib/firebase/admin"
import {
  collectionPathFor,
  embedIfChanged,
  type Kind,
} from "@/lib/embeddings/embeddable"
import { currentEmbeddingModel } from "@/lib/embeddings/provider"
import { TIMBL_FIREBASE_PROJECT_PROD } from "@/lib/constants/timbl"

/* Migration 0020 - production-capable 0011 for EMBEDDING_PROVIDER=openrouter.
 * Must run with the same provider as the deployed app, or retrieve() filters
 * the new vectors out. */

const PER_ORG_KINDS: Kind[] = ["post", "campaign", "template", "agentMemory"]
const GLOBAL_KINDS: Kind[] = ["awarenessDay"]
const SCAN_LIMIT = 5000

let softFailedTotal = 0

async function reembedKind(kind: Kind, orgId: string): Promise<void> {
  const snap = await getAdminDb()
    .collection(collectionPathFor(kind, orgId))
    .limit(SCAN_LIMIT)
    .get()
  const counts = { wrote: 0, skippedHash: 0, skippedEmpty: 0, softFailed: 0 }
  for (const d of snap.docs) {
    const status = await embedIfChanged(kind, orgId, d.id, {
      ...d.data(),
      id: d.id,
    })
    if (status === "wrote") counts.wrote++
    else if (status === "skipped-hash") counts.skippedHash++
    else if (status === "skipped-empty") counts.skippedEmpty++
    else counts.softFailed++
  }
  softFailedTotal += counts.softFailed
  console.log(
    `  ${kind.padEnd(13)} org=${orgId} total=${snap.size} ` +
      `re-embedded=${counts.wrote} unchanged=${counts.skippedHash} ` +
      `empty=${counts.skippedEmpty} soft-fail=${counts.softFailed}`,
  )
}

export async function migrate0020ReembedOpenRouter(): Promise<void> {
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

  if (process.env.EMBEDDING_PROVIDER !== "openrouter") {
    throw new Error(
      `EMBEDDING_PROVIDER is "${process.env.EMBEDDING_PROVIDER ?? "(unset)"}", ` +
        "expected openrouter to match the deployed app - aborting.",
    )
  }
  const target = currentEmbeddingModel()
  if (target.startsWith("mock")) {
    throw new Error("Embedding provider resolved to mock (AGENT_MOCK_LLM=1?) - aborting.")
  }

  console.log(
    emulator
      ? `→ migration 0020 against emulator @ ${emulator} (project ${projectId}), target ${target}`
      : `→ migration 0020 against REAL Firestore project ${projectId}, target ${target}`,
  )

  const orgs = await getAdminDb().collection("organizations").get()
  for (const org of orgs.docs) {
    for (const kind of PER_ORG_KINDS) await reembedKind(kind, org.id)
  }
  if (orgs.docs[0]) {
    for (const kind of GLOBAL_KINDS) await reembedKind(kind, orgs.docs[0].id)
  }

  if (softFailedTotal > 0) {
    throw new Error(
      `migration 0020: ${softFailedTotal} docs failed to embed - check the ` +
        "embedding key and re-run (idempotent).",
    )
  }
  console.log("✓ migration 0020 complete")
}

if (require.main === module) {
  migrate0020ReembedOpenRouter().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

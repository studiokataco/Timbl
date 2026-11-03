import { FieldValue } from "firebase-admin/firestore"

import { getAdminApp, getAdminDb } from "@/lib/firebase/admin"
import { collectionPathFor, type Kind } from "@/lib/embeddings/embeddable"
import { TIMBL_FIREBASE_PROJECT_PROD } from "@/lib/constants/timbl"

/* Migration 0022 - store embedding vectors as Firestore vectors. Plain arrays
 * are invisible to findNearest, so production retrieval returned nothing.
 * Converts in place; no re-embedding. */

const PER_ORG_KINDS: Kind[] = ["post", "campaign", "template", "agentMemory"]

export async function migrate0022VectorType(): Promise<void> {
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
      ? `→ migration 0022 against emulator @ ${emulator} (project ${projectId})`
      : `→ migration 0022 against REAL Firestore project ${projectId}`,
  )

  const db = getAdminDb()
  const paths = new Set<string>([collectionPathFor("awarenessDay", "")])
  const orgs = await db.collection("organizations").get()
  for (const org of orgs.docs) {
    for (const kind of PER_ORG_KINDS) paths.add(collectionPathFor(kind, org.id))
  }

  let converted = 0
  let already = 0
  for (const path of paths) {
    const snap = await db.collection(path).get()
    for (const d of snap.docs) {
      const vector = d.data().embedding?.vector
      if (!Array.isArray(vector)) {
        if (vector) already++
        continue
      }
      await d.ref.update({ "embedding.vector": FieldValue.vector(vector) })
      converted++
    }
  }

  console.log(`✓ migration 0022: ${converted} converted, ${already} already vectors`)
}

if (require.main === module) {
  migrate0022VectorType().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

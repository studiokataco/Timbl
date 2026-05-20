import { db, ensureEmulator } from "./_helpers"
import {
  collectionPathFor,
  embedIfChanged,
  type Kind,
} from "@/lib/embeddings/embeddable"
import { currentEmbeddingModel } from "@/lib/embeddings/provider"

/*
 * Re-embed migration — append-only (never edit 0009; this is its successor
 * for the model-switch case, per §6.7 of the pluggable-providers plan).
 *
 * Run this MANUALLY after the embedding model changes. It is NOT wired
 * into firestore/seeds/run.ts — a re-embed is an on-demand migration, not
 * something every `pnpm seed` should do.
 *
 * Mechanism: embedIfChanged() now re-embeds whenever a stored vector's
 * `embedding.model` differs from the current model (not just on a text
 * edit). So this script simply walks every embeddable collection in every
 * org and calls it. Idempotent: a second run is all skip-hash. During the
 * migration retrieve() returns sparse-but-correct results — stale-model
 * vectors are filtered out, quality ramps, nothing breaks.
 *
 * Per-org kinds live under organizations/{orgId}/...; awarenessDay is a
 * global collection and is migrated once.
 */

const PER_ORG_KINDS: Kind[] = ["post", "campaign", "template", "agentMemory"]
const GLOBAL_KINDS: Kind[] = ["awarenessDay"]
const SCAN_LIMIT = 5000

async function reembedKind(kind: Kind, orgId: string): Promise<void> {
  const path = collectionPathFor(kind, orgId)
  const snap = await db().collection(path).limit(SCAN_LIMIT).get()
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
  console.log(
    `  ${kind.padEnd(13)} org=${orgId} total=${snap.size} ` +
      `re-embedded=${counts.wrote} unchanged=${counts.skippedHash} ` +
      `empty=${counts.skippedEmpty} soft-fail=${counts.softFailed}`,
  )
}

export async function seed0011ReembedMigration(): Promise<void> {
  ensureEmulator()
  console.log(`→ re-embed migration — target model: ${currentEmbeddingModel()}`)

  const orgs = await db().collection("organizations").get()
  for (const org of orgs.docs) {
    for (const kind of PER_ORG_KINDS) await reembedKind(kind, org.id)
  }
  // awarenessDay is a single global collection — migrate it once.
  if (orgs.docs[0]) {
    for (const kind of GLOBAL_KINDS) {
      await reembedKind(kind, orgs.docs[0].id)
    }
  }
  console.log("✓ re-embed migration complete")
}

if (require.main === module) {
  seed0011ReembedMigration().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

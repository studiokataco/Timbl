import { db, ensureEmulator, SAFE_ORG_ID } from "./_helpers"
import { collectionPathFor, embedIfChanged, type Kind } from "@/lib/embeddings/embeddable"

/*
 * Idempotent backfill across every embeddable collection. Re-run is cheap:
 * each doc's `sourceHash` gate skips when the semantic fields haven't
 * changed. In mock mode (AGENT_MOCK_LLM=1 or no provider key) the writes
 * are still deterministic, so seed/dev boots are stable across reboots.
 *
 * Scans up to BACKFILL_LIMIT per kind - well above the seeded corpus and
 * enough to catch any organic growth during dev. Bumps required if SAFE
 * ever exceeds it.
 */

const KINDS_FOR_SAFE: Kind[] = ["post", "campaign", "template", "agentMemory"]
const GLOBAL_KINDS: Kind[] = ["awarenessDay"]
const BACKFILL_LIMIT = 5000

async function backfillKind(kind: Kind, orgId: string): Promise<void> {
  const path = collectionPathFor(kind, orgId)
  const snap = await db().collection(path).limit(BACKFILL_LIMIT).get()
  const counts = { wrote: 0, skippedHash: 0, skippedEmpty: 0, softFailed: 0 }
  for (const d of snap.docs) {
    const status = await embedIfChanged(kind, orgId, d.id, { ...d.data(), id: d.id })
    if (status === "wrote") counts.wrote++
    else if (status === "skipped-hash") counts.skippedHash++
    else if (status === "skipped-empty") counts.skippedEmpty++
    else counts.softFailed++
  }
  console.log(
    `  ${kind.padEnd(13)} total=${snap.size} wrote=${counts.wrote} ` +
      `skip-hash=${counts.skippedHash} skip-empty=${counts.skippedEmpty} ` +
      `soft-fail=${counts.softFailed}`,
  )
}

export async function seed0009EmbeddingsBackfill(): Promise<void> {
  ensureEmulator()
  console.log("→ backfilling embeddings")
  for (const kind of KINDS_FOR_SAFE) await backfillKind(kind, SAFE_ORG_ID)
  for (const kind of GLOBAL_KINDS) await backfillKind(kind, SAFE_ORG_ID)
  console.log("✓ embeddings backfill")
}

if (require.main === module) {
  seed0009EmbeddingsBackfill().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

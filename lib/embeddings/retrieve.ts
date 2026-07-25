import { FieldValue } from "firebase-admin/firestore"

import { getAdminDb } from "@/lib/firebase/admin"
import { DEFAULT_BRAND_ID } from "@/lib/constants/timbl"

import { collectionPathFor, toEmbeddingText, type Kind } from "./embeddable"
import { embed } from "./provider"

/*
 * Top-k similarity over an embeddable collection.
 *
 * Emulator path: brute-force cosine. Demo org has well under 2k docs of each
 * kind, so a single .get() + in-process scoring beats wiring up a vector
 * index. The 2000 cap keeps the read bounded if a future bug ever blows up.
 *
 * Cloud path (Phase 7+): Firestore native findNearest. Same call surface;
 * the only switch is the FIRESTORE_EMULATOR_HOST env var. The vector
 * indexes are declared in firestore.indexes.json (deferred until deploy).
 */

export type RetrieveHit = { id: string; snippet: string; score: number }

export interface RetrieveOptions {
  orgId: string
  kind: Kind
  query: string
  k?: number
  /* When set, only docs belonging to this brand are returned - a doc with no
   * brandId field counts as the default brand. Leave unset only for genuinely
   * org-global kinds (awarenessDay). This is the guard that stops one client's
   * memories and drafts leaking into another client's retrieval. */
  brandId?: string
  filter?: (doc: Record<string, unknown>) => boolean
}

const SNIPPET_LEN = 240
const SCAN_LIMIT = 2000

/* Length mismatch means the two vectors came from different embedding
 * models - scoring them against each other is meaningless. Return 0
 * instead of the old Math.min() truncation, which silently produced a
 * plausible-but-wrong similarity. The model filter in retrieve() should
 * prevent this from ever being reached; this is the backstop. */
function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

export async function retrieve(opts: RetrieveOptions): Promise<RetrieveHit[]> {
  const k = opts.k ?? 5
  const useNativeKnn = !process.env.FIRESTORE_EMULATOR_HOST
  const db = getAdminDb()
  const path = collectionPathFor(opts.kind, opts.orgId)

  /* Embed the query and pin retrieval to that exact model. Only stored
   * vectors stamped with the same `embedding.model` are scored - a
   * collection mid-migration (mixed models) yields sparse-but-correct
   * results, never cross-model garbage (§6.7). */
  const { vector, model } = await embed(opts.query)

  const brandMatch = (data: Record<string, unknown>): boolean =>
    opts.brandId === undefined ||
    ((data.brandId as string | undefined) ?? DEFAULT_BRAND_ID) === opts.brandId

  if (useNativeKnn) {
    /* Over-fetch, then post-filter by model. findNearest can't prefilter
     * on embedding.model without a composite vector index; fetching a
     * wider window and filtering in-process is correct and index-free.
     * During a re-embed migration this can still return < k - that's the
     * accepted sparse-but-correct behaviour. */
    const knnQuery = db.collection(path).findNearest({
      vectorField: "embedding.vector",
      queryVector: FieldValue.vector(vector),
      limit: k * 4,
      distanceMeasure: "COSINE",
    })
    const snap = await knnQuery.get()
    const hits: RetrieveHit[] = []
    for (const d of snap.docs) {
      const data = d.data() as Record<string, unknown>
      if (!brandMatch(data)) continue
      if (opts.filter && !opts.filter(data)) continue
      const emb = data.embedding as { model?: string } | undefined
      if (emb?.model !== model) continue
      hits.push({
        id: d.id,
        snippet: toEmbeddingText(opts.kind, data).slice(0, SNIPPET_LEN),
        // Firestore returns distance, not similarity. Convert COSINE
        // distance (1 - cos) back to similarity for caller ergonomics.
        score: 1 - ((d as unknown as { distance?: number }).distance ?? 0),
      })
    }
    return hits.slice(0, k)
  }

  // Emulator brute force.
  const snap = await db.collection(path).limit(SCAN_LIMIT).get()
  const scored: RetrieveHit[] = []
  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>
    if (!brandMatch(data)) continue
    if (opts.filter && !opts.filter(data)) continue
    const emb = data.embedding as
      | { vector?: number[]; model?: string }
      | undefined
    if (!emb?.vector?.length) continue
    if (emb.model !== model) continue
    scored.push({
      id: d.id,
      snippet: toEmbeddingText(opts.kind, data).slice(0, SNIPPET_LEN),
      score: cosine(vector, emb.vector),
    })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, k)
}

import { FieldValue } from "firebase-admin/firestore"

import { getAdminDb } from "@/lib/firebase/admin"

import { collectionPathFor, toEmbeddingText, type Kind } from "./embeddable"
import { embed } from "./provider"

/*
 * Top-k similarity over an embeddable collection.
 *
 * Emulator path: brute-force cosine. SAFE has well under 2k docs of each
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
  filter?: (doc: Record<string, unknown>) => boolean
}

const SNIPPET_LEN = 240
const SCAN_LIMIT = 2000

function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < n; i++) {
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

  const { vector } = await embed(opts.query)

  if (useNativeKnn) {
    const knnQuery = db.collection(path).findNearest({
      vectorField: "embedding.vector",
      queryVector: FieldValue.vector(vector),
      limit: k,
      distanceMeasure: "COSINE",
    })
    const snap = await knnQuery.get()
    const hits: RetrieveHit[] = []
    for (const d of snap.docs) {
      const data = d.data() as Record<string, unknown>
      if (opts.filter && !opts.filter(data)) continue
      hits.push({
        id: d.id,
        snippet: toEmbeddingText(opts.kind, data).slice(0, SNIPPET_LEN),
        // Firestore returns distance, not similarity. Convert COSINE
        // distance (1 - cos) back to similarity for caller ergonomics.
        score: 1 - ((d as unknown as { distance?: number }).distance ?? 0),
      })
    }
    return hits
  }

  // Emulator brute force.
  const snap = await db.collection(path).limit(SCAN_LIMIT).get()
  const scored: RetrieveHit[] = []
  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>
    if (opts.filter && !opts.filter(data)) continue
    const emb = data.embedding as { vector?: number[] } | undefined
    if (!emb?.vector?.length) continue
    scored.push({
      id: d.id,
      snippet: toEmbeddingText(opts.kind, data).slice(0, SNIPPET_LEN),
      score: cosine(vector, emb.vector),
    })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, k)
}

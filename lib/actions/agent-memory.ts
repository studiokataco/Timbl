"use server"

import { z } from "zod"

import { getCurrentOrgId, getDb } from "@/lib/auth/server-helpers"
import { DEFAULT_BRAND_ID } from "@/lib/constants/timbl"
import { embedIfChanged } from "@/lib/embeddings/embeddable"
import { retrieve } from "@/lib/embeddings/retrieve"
import { orgAgentMemoryPath } from "@/lib/firebase/paths"
import { snapToData } from "@/lib/firebase/serialize"
import { type AgentMemory, type ServerActionResult } from "@/lib/schemas"

/*
 * Agent memory CRUD + semantic listing. recordMemory is what human-gate
 * calls (Stage 2) when persisting reviewer rationale. listMemories is what
 * recall() agent-tool will wrap - semantic when `query` is set, exact-topic
 * lookup when only `topic`, otherwise the latest 50.
 */

const recordSchema = z.object({
  topic: z.string().min(1).max(120),
  body: z.string().min(1).max(4_000),
})
export type RecordMemoryInput = z.infer<typeof recordSchema>

export async function recordMemory(input: unknown): Promise<ServerActionResult> {
  const parsed = recordSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" }
  }
  const orgId = await getCurrentOrgId()
  const db = getDb()
  const ref = db.collection(orgAgentMemoryPath(orgId)).doc()
  const now = new Date().toISOString()
  const doc: AgentMemory = {
    id: ref.id,
    brandId: DEFAULT_BRAND_ID,
    topic: parsed.data.topic,
    body: parsed.data.body,
    createdAt: now,
  }
  await ref.set(doc)
  try {
    await embedIfChanged("agentMemory", orgId, ref.id, doc as unknown as Record<string, unknown>)
  } catch (err) {
    console.warn(`[embed] agentMemory soft-fail: ${err instanceof Error ? err.message : err}`)
  }
  return { ok: true, id: ref.id }
}

const listSchema = z.object({
  topic: z.string().optional(),
  query: z.string().optional(),
  k: z.number().int().min(1).max(50).optional(),
})

export type MemoryListItem = {
  id: string
  topic: string
  body: string
  createdAt: string
  score?: number
}

export async function listMemories(input: unknown): Promise<MemoryListItem[]> {
  const parsed = listSchema.safeParse(input ?? {})
  if (!parsed.success) return []
  const orgId = await getCurrentOrgId()
  const db = getDb()

  if (parsed.data.query) {
    const hits = await retrieve({
      orgId,
      kind: "agentMemory",
      query: parsed.data.query,
      k: parsed.data.k ?? 5,
      brandId: DEFAULT_BRAND_ID,
      filter: parsed.data.topic
        ? (d) => (d as { topic?: string }).topic === parsed.data.topic
        : undefined,
    })
    if (hits.length === 0) return []
    const refs = hits.map((h) => db.doc(`${orgAgentMemoryPath(orgId)}/${h.id}`))
    const snaps = await db.getAll(...refs)
    const byId = new Map(snaps.filter((s) => s.exists).map((s) => [s.id, snapToData<AgentMemory>(s)]))
    const out: MemoryListItem[] = []
    for (const h of hits) {
      const doc = byId.get(h.id)
      if (!doc) continue
      out.push({ id: doc.id, topic: doc.topic, body: doc.body, createdAt: doc.createdAt, score: h.score })
    }
    return out
  }

  let q = db.collection(orgAgentMemoryPath(orgId)).limit(parsed.data.k ?? 50) as FirebaseFirestore.Query
  if (parsed.data.topic) q = q.where("topic", "==", parsed.data.topic)
  const snap = await q.get()
  return snap.docs.map((d) => {
    const m = snapToData<AgentMemory>(d)
    return { id: m.id, topic: m.topic, body: m.body, createdAt: m.createdAt }
  })
}

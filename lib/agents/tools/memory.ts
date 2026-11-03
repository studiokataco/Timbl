import { z } from "zod"
import { FunctionTool } from "@google/adk"

import { getAdminDb } from "@/lib/firebase/admin"
import { embedIfChanged } from "@/lib/embeddings/embeddable"
import { retrieve } from "@/lib/embeddings/retrieve"
import { orgAgentMemoryPath } from "@/lib/firebase/paths"
import { snapToData } from "@/lib/firebase/serialize"
import type { AgentMemory } from "@/lib/schemas"

import { DEFAULT_BRAND_ID } from "@/lib/constants/timbl"

import { getRuntimeCtx } from "../runtime/context"
import { fenceUntrusted } from "../runtime/guardrails"

/*
 * Agent-side memory tools. Bypass lib/actions/agent-memory.ts on purpose -
 * we already have orgId from session state, so going through getCurrentOrgId()
 * would re-resolve from cookies (and fail under cron triggers which have no
 * cookie). Mirrors the brand.ts pattern.
 *
 * `remember` is typically invoked by human-gate when a reviewer or admin
 * provides rationale alongside an approval/edit. `recall` is what drafter +
 * reviewer call before producing or critiquing a draft - past corrections
 * should not be re-asked.
 */

const rememberInput = z.object({
  topic: z.string().min(1).max(120).describe(
    "Short topic key. Free-form, but stay consistent: 'voice', 'campaign:20th-anniversary', a category slug.",
  ),
  body: z.string().min(1).max(4_000).describe("The fact or correction to remember, in 1-4 sentences."),
})

export const rememberTool = new FunctionTool({
  name: "remember",
  description:
    "Persist a small fact or correction to agentMemory. Use for reviewer rationale, brand voice clarifications a human gave during approval, or campaign-specific guidance worth re-reading on future runs.",
  parameters: rememberInput,
  execute: async (input, ctx) => {
    const { orgId, brandId } = getRuntimeCtx(ctx)
    const db = getAdminDb()
    const ref = db.collection(orgAgentMemoryPath(orgId)).doc()
    const now = new Date().toISOString()
    const doc: AgentMemory = {
      id: ref.id,
      brandId: brandId ?? DEFAULT_BRAND_ID,
      topic: input.topic,
      body: input.body,
      createdAt: now,
    }
    await ref.set(doc)
    try {
      await embedIfChanged("agentMemory", orgId, ref.id, doc as unknown as Record<string, unknown>)
    } catch {
      /* embedIfChanged soft-fails internally; this catch is belt-and-braces */
    }
    return { ok: true, id: ref.id }
  },
})

const recallInput = z.object({
  query: z.string().min(1).describe("Natural-language description of what you're about to do, so similar past memories surface."),
  topic: z.string().optional().describe("Optional - narrow to a single topic key."),
  k: z.number().int().min(1).max(20).default(5),
})

export const recallTool = new FunctionTool({
  name: "recall",
  description:
    "Semantic recall over agentMemory. Returns up to k prior memories most relevant to the query. Inspect these BEFORE producing a draft or critique - applying a remembered correction is cheaper than re-asking the human.",
  parameters: recallInput,
  execute: async (input, ctx) => {
    const { orgId, brandId } = getRuntimeCtx(ctx)
    const hits = await retrieve({
      orgId,
      kind: "agentMemory",
      query: input.query,
      k: input.k,
      brandId: brandId ?? DEFAULT_BRAND_ID,
      filter: input.topic ? (d) => (d as { topic?: string }).topic === input.topic : undefined,
    })
    if (hits.length === 0) return { memories: [] }
    const db = getAdminDb()
    const refs = hits.map((h) => db.doc(`${orgAgentMemoryPath(orgId)}/${h.id}`))
    const snaps = await db.getAll(...refs)
    const byId = new Map(snaps.filter((s) => s.exists).map((s) => [s.id, snapToData<AgentMemory>(s)]))
    const memories = hits
      .map((h) => {
        const doc = byId.get(h.id)
        if (!doc) return undefined
        return { id: doc.id, topic: doc.topic, body: fenceUntrusted(doc.body), createdAt: doc.createdAt, score: h.score }
      })
      .filter((m): m is { id: string; topic: string; body: string; createdAt: string; score: number } => m !== undefined)
    return { memories }
  },
})

const INTENT_TOPIC = "intent"

const rememberIntentInput = z.object({
  phrase: z.string().min(1).max(300).describe("The person's own wording of the ambiguous ask, verbatim."),
  meaning: z.string().min(1).max(1_000).describe("What the person confirmed they meant, in one or two sentences."),
})

export const rememberIntentTool = new FunctionTool({
  name: "rememberIntent",
  description:
    "Save how this workspace phrases an ambiguous ask, so it is not decoded again. Call ONLY after the person confirmed or answered - never save your own guess.",
  parameters: rememberIntentInput,
  execute: async (input, ctx) => {
    const { orgId, brandId } = getRuntimeCtx(ctx)
    const db = getAdminDb()
    const ref = db.collection(orgAgentMemoryPath(orgId)).doc()
    const doc: AgentMemory = {
      id: ref.id,
      brandId: brandId ?? DEFAULT_BRAND_ID,
      topic: INTENT_TOPIC,
      body: `When they say "${input.phrase}", they mean: ${input.meaning}`,
      createdAt: new Date().toISOString(),
    }
    await ref.set(doc)
    await embedIfChanged("agentMemory", orgId, ref.id, doc as unknown as Record<string, unknown>)
    return { ok: true, id: ref.id }
  },
})

const recallIntentInput = z.object({
  phrase: z.string().min(1).max(300).describe("The person's wording of the ambiguous ask."),
})

export const recallIntentTool = new FunctionTool({
  name: "recallIntent",
  description:
    "Look up confirmed meanings of past ambiguous asks that resemble this one. Higher score means closer wording.",
  parameters: recallIntentInput,
  execute: async (input, ctx) => {
    const { orgId, brandId } = getRuntimeCtx(ctx)
    const hits = await retrieve({
      orgId,
      kind: "agentMemory",
      query: input.phrase,
      k: 10,
      brandId: brandId ?? DEFAULT_BRAND_ID,
      filter: (d) => (d as { topic?: string }).topic === INTENT_TOPIC,
    })
    if (hits.length === 0) return { meanings: [] }
    const db = getAdminDb()
    const snaps = await db.getAll(...hits.map((h) => db.doc(`${orgAgentMemoryPath(orgId)}/${h.id}`)))
    const bodies = new Map(snaps.filter((x) => x.exists).map((x) => [x.id, snapToData<AgentMemory>(x).body]))
    return {
      meanings: hits
        .filter((h) => bodies.has(h.id))
        .slice(0, 3)
        .map((h) => ({ meaning: fenceUntrusted(bodies.get(h.id)!), score: h.score })),
    }
  },
})

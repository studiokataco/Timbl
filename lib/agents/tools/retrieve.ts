import { z } from "zod"
import { FunctionTool } from "@google/adk"

import { retrieve } from "@/lib/embeddings/retrieve"
import type { Kind } from "@/lib/embeddings/embeddable"

import { getRuntimeCtx } from "../runtime/context"
import { fenceUntrusted } from "../runtime/guardrails"

/*
 * Semantic retrieval over the embeddable collections. Agents use this to
 * ground new work in prior approved posts (drafter), avoid re-treading
 * covered ideas (ideator), or pull adjacent context (reviewer).
 *
 * The optional `approvedOnly` flag is the most common drafter filter - it
 * narrows posts to those a human has signed off on, so the voice samples
 * the LLM sees are authoritative rather than aspirational.
 */

const KIND_VALUES = ["post", "campaign", "template", "awarenessDay", "agentMemory"] as const
const kindEnum = z.enum(KIND_VALUES)

const retrieveInput = z.object({
  kind: kindEnum.describe(
    "Which collection to search: post (drafts + scheduled + posted), campaign, template, awarenessDay, or agentMemory.",
  ),
  query: z.string().min(1).describe("Natural-language query - the brief, topic, or idea you want adjacent context for."),
  k: z.number().int().min(1).max(20).default(5),
  campaignId: z.string().optional().describe("Optional - narrow to a single campaign. Only meaningful for kind=post."),
  approvedOnly: z.boolean().default(false).describe(
    "Posts only: when true, returns only posts whose agentMeta.reviewState === 'approved'. Use when grounding voice from authoritative examples.",
  ),
})

export const retrieveTool = new FunctionTool({
  name: "retrieve",
  description:
    "Top-k semantic search over an embeddable collection (post / campaign / template / awarenessDay / agentMemory). Returns items with id, snippet, and similarity score (higher = closer).",
  parameters: retrieveInput,
  execute: async (input, ctx) => {
    const { orgId } = getRuntimeCtx(ctx)
    const hits = await retrieve({
      orgId,
      kind: input.kind as Kind,
      query: input.query,
      k: input.k,
      filter: (doc) => {
        if (input.campaignId && doc.campaignId !== input.campaignId) return false
        if (input.approvedOnly && input.kind === "post") {
          const meta = doc.agentMeta as { reviewState?: string } | undefined
          if (meta?.reviewState !== "approved") return false
        }
        return true
      },
    })
    return { hits: hits.map((h) => ({ ...h, snippet: fenceUntrusted(h.snippet) })) }
  },
})

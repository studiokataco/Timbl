import { z } from "zod"
import { FunctionTool } from "@google/adk"
import { randomUUID } from "node:crypto"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgIdeationFeedPath } from "@/lib/firebase/paths"
import { isoDate } from "@/lib/schemas/_shared"

import { getRuntimeCtx } from "../runtime/context"

/* Persist a single ideation item - the ideator emits one of these per
 * candidate idea after grounding its claims via GOOGLE_SEARCH /
 * URL_CONTEXT. The shape mirrors lib/schemas/ideationItem.ts. */

const input = z.object({
  title: z.string().min(1).max(280),
  summary: z.string().max(4_000),
  sourceUrls: z.array(z.string().url()).default([]),
  suggestedDate: isoDate.optional(),
  suggestedCategorySlug: z.string().optional(),
  awarenessDayId: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0.5),
})

export const persistIdeationTool = new FunctionTool({
  name: "persistIdeation",
  description:
    "Persist a single ideation item to the org's ideation feed. Call this once per candidate topic. Include `sourceUrls` so a human reviewer can verify your claims.",
  parameters: input,
  execute: async (item, ctx) => {
    const { orgId, runId } = getRuntimeCtx(ctx)
    const id = randomUUID()
    const now = new Date().toISOString()
    await getAdminDb()
      .collection(orgIdeationFeedPath(orgId))
      .doc(id)
      .set({
        id,
        organizationId: orgId,
        title: item.title,
        summary: item.summary,
        sourceUrls: item.sourceUrls,
        suggestedDate: item.suggestedDate ?? null,
        suggestedCategorySlug: item.suggestedCategorySlug ?? null,
        awarenessDayId: item.awarenessDayId ?? null,
        status: "new",
        confidence: item.confidence,
        createdByRunId: runId,
        createdAt: now,
        updatedAt: now,
      })
    return { ok: true, itemId: id }
  },
})

import { z } from "zod"
import { FunctionTool } from "@google/adk"
import { randomUUID } from "node:crypto"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgAwarenessProposalsPath } from "@/lib/firebase/paths"
import { detectLlmStatus } from "../runtime/llm-registry"
import { awarenessImportance, awarenessRecurrence } from "@/lib/schemas/awarenessDay"
import { isoDate } from "@/lib/schemas/_shared"

import { getRuntimeCtx } from "../runtime/context"

/*
 * Proposes awareness days discovered by the agent via Gemini's native
 * Google Search grounding. The tool itself does NOT perform the web
 * search — the LLM does, via GOOGLE_SEARCH. Each call records ONE
 * proposed day to /organizations/{orgId}/awarenessDayProposals/{auto-id}
 * with `proposed: true` and `status: "proposed"`, so a human can vet it
 * in the UI before it lands in the official `awarenessDays` collection.
 *
 * Gemini-only by design: if the LLM registry isn't running on Gemini
 * (no key, or fallback to Anthropic/Mock), GOOGLE_SEARCH is unavailable
 * and any "discovery" would be hallucinated. We short-circuit in that
 * case rather than silently writing low-confidence proposals.
 */

const input = z.object({
  date: isoDate,
  name: z.string().min(1).max(280),
  description: z.string().max(2_000).optional(),
  sourceUrls: z
    .array(z.string().url())
    .min(1, "Each proposal needs at least one source URL from your Google Search grounding"),
  importance: awarenessImportance.default("medium"),
  recurringPattern: awarenessRecurrence.default("annual"),
  suggestedCategorySlug: z.string().optional(),
})

export const proposeAwarenessDayTool = new FunctionTool({
  name: "proposeAwarenessDay",
  description:
    "Record ONE proposed awareness day discovered via Google Search grounding. Call once per day. `sourceUrls` must contain real URLs from the grounded search results — do not invent URLs.",
  parameters: input,
  execute: async (item, ctx) => {
    const { orgId, runId } = getRuntimeCtx(ctx)

    const status = detectLlmStatus()
    if (status.effective !== "gemini") {
      return {
        ok: false,
        error:
          "Awareness research requires Gemini provider with google-search grounding enabled. Set GEMINI_API_KEY (or GOOGLE_GENAI_API_KEY) and switch this agent to provider=gemini.",
      }
    }

    const id = randomUUID()
    const now = new Date().toISOString()
    await getAdminDb()
      .collection(orgAwarenessProposalsPath(orgId))
      .doc(id)
      .set({
        id,
        organizationId: orgId,
        date: item.date,
        name: item.name,
        description: item.description ?? null,
        sourceUrls: item.sourceUrls,
        importance: item.importance,
        recurringPattern: item.recurringPattern,
        suggestedCategorySlug: item.suggestedCategorySlug ?? null,
        proposed: true,
        status: "proposed",
        agentRunId: runId,
        createdAt: now,
        updatedAt: now,
      })
    return { ok: true, proposalId: id, name: item.name, date: item.date }
  },
})

import { z } from "zod"
import { FunctionTool } from "@google/adk"
import { randomUUID } from "node:crypto"

import { getAdminDb } from "@/lib/firebase/admin"
import { awarenessDaysPath, orgAwarenessProposalsPath } from "@/lib/firebase/paths"
import { detectLlmStatus } from "../runtime/llm-registry"
import { awarenessRecurrence } from "@/lib/schemas/awarenessDay"
import { isoDate } from "@/lib/schemas/_shared"

import { getRuntimeCtx } from "../runtime/context"

/*
 * Proposes awareness days the agent discovered by searching. The tool does
 * NOT perform the search - the LLM does, through whichever grounding path
 * its provider offers. Each call records ONE proposed day to
 * /organizations/{orgId}/awarenessDayProposals/{auto-id} with `proposed:
 * true` and `status: "proposed"`, so a human vets it before it lands in the
 * official `awarenessDays` collection.
 *
 * The tool is the last line of defence on quality, because everything above
 * it is a model's word. Two things are checked before anything is written:
 *
 *   1. The citation is a real, fetchable source. A model that skipped the
 *      search still emits confident-looking URLs - most often the
 *      vertexaisearch.cloud.google.com/grounding-api-redirect/... tokens it
 *      memorised in training, which resolve to nothing.
 *   2. The day is not already proposed or already live. Left unchecked a
 *      single run proposes the same observance twice and both end up on the
 *      board.
 *
 * Requires live web grounding: OpenRouter web search or Gemini's native
 * GOOGLE_SEARCH. If neither is reachable (mock / anthropic-only), any
 * "discovery" would be hallucinated, so we short-circuit rather than
 * silently writing low-confidence proposals.
 */

const input = z.object({
  date: isoDate,
  name: z.string().min(1).max(280),
  description: z.string().max(2_000).optional(),
  sourceUrls: z
    .array(z.string().url())
    .min(1, "Each proposal needs at least one source URL from your search results"),
  recurringPattern: awarenessRecurrence.default("annual"),
})

/* Search-provider redirect wrappers. They are not sources - they are opaque
 * handles into a grounding session, dead the moment it ends, and a model
 * reciting one from memory has cited nothing at all. */
const CITATION_PROXY_HOSTS = [
  "vertexaisearch.cloud.google.com",
  "grounding-api-redirect",
  "googleusercontent.com",
  "bing.com/ck/a",
  "duckduckgo.com/l/",
]

function isUsableCitation(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false
  /* A bare hostname with no path is a homepage, not evidence for a date. */
  const haystack = `${url.host}${url.pathname}`.toLowerCase()
  return !CITATION_PROXY_HOSTS.some((bad) => haystack.includes(bad))
}

/* Same observance, written two ways ("World Alzheimer's Day" /
 * "World Alzheimers Day"), should collide. Punctuation and case carry no
 * meaning here. */
function dedupeKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim()
}

export const proposeAwarenessDayTool = new FunctionTool({
  name: "proposeAwarenessDay",
  description:
    "Record ONE proposed awareness day you found by searching. Call once per day - a repeat of a day already proposed is rejected. `sourceUrls` must be real page URLs you actually opened in the search results; search-engine redirect links and invented URLs are rejected.",
  parameters: input,
  execute: async (item, ctx) => {
    const { orgId, runId } = getRuntimeCtx(ctx)

    const status = detectLlmStatus()
    if (!status.webResearch) {
      return {
        ok: false,
        error:
          "Awareness research requires live web grounding. Set OPENROUTER_API_KEY (OpenRouter web search) or GEMINI_API_KEY (Gemini google-search grounding) and point this agent at that provider.",
      }
    }

    const citations = item.sourceUrls.filter(isUsableCitation)
    if (citations.length === 0) {
      return {
        ok: false,
        error:
          `Rejected "${item.name}": none of the sourceUrls is a citable page. ` +
          "Search the web, open a real source (UN, WHO, a government health body, an " +
          "established NGO, or mainstream press), and cite that page's own URL - not a " +
          "search-engine redirect link and not a URL from memory.",
      }
    }

    const db = getAdminDb()
    const key = dedupeKey(item.name)

    /* Same-date proposals only - the query stays cheap and an observance
     * moving date year to year is a genuinely different proposal. Rejected
     * ones don't block: a human said no to that wording, not to the day. */
    const sameDate = await db
      .collection(orgAwarenessProposalsPath(orgId))
      .where("date", "==", item.date)
      .get()
    const clash = sameDate.docs.find((doc) => {
      const d = doc.data()
      return d.status !== "rejected" && dedupeKey((d.name as string) ?? "") === key
    })
    if (clash) {
      return {
        ok: false,
        error:
          `"${item.name}" on ${item.date} is already proposed (${clash.id}). ` +
          "Move on to a different day - do not propose it again.",
      }
    }

    const live = await db
      .collection(awarenessDaysPath)
      .where("date", "==", item.date)
      .get()
    const alreadyLive = live.docs.find(
      (doc) => dedupeKey((doc.data().name as string) ?? "") === key,
    )
    if (alreadyLive) {
      return {
        ok: false,
        error:
          `"${item.name}" on ${item.date} is already an accepted awareness day. ` +
          "Move on to a different day.",
      }
    }

    const id = randomUUID()
    const now = new Date().toISOString()
    await db
      .collection(orgAwarenessProposalsPath(orgId))
      .doc(id)
      .set({
        id,
        organizationId: orgId,
        date: item.date,
        name: item.name,
        description: item.description ?? null,
        /* Only the citations that survived the check - a reviewer clicking
         * through must never land on a dead redirect handle. */
        sourceUrls: citations,
        recurringPattern: item.recurringPattern,
        proposed: true,
        status: "proposed",
        agentRunId: runId,
        createdAt: now,
        updatedAt: now,
      })
    return { ok: true, proposalId: id, name: item.name, date: item.date }
  },
})

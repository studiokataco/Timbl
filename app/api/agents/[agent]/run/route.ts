import type { NextRequest } from "next/server"
import { z } from "zod"

import { getCurrentOrgId, getCurrentUser } from "@/lib/auth/server-helpers"
import { getCurrentBrandId } from "@/lib/brand/brand-session"
import { startAgentRun, markAgentRunStatus } from "@/lib/agents/triggers/manual"
import { gateErrorToResult } from "@/lib/plans/gate"
import {
  eventsToSseStream,
  SSE_HEADERS,
  collectCustomMetadata,
} from "@/lib/agents/runtime/events"
import type { Event } from "@google/adk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({
  input: z.string().min(1).max(10_000),
  trigger: z.enum(["manual", "pipeline"]).default("manual"),
  dedupKey: z.string().optional(),
  /* Per-conversation model override; both fields optional so the saved
   * agentConfig default applies when omitted. */
  provider: z
    .enum(["gemini", "anthropic", "openrouter", "ollama", "mock"])
    .optional(),
  model: z.string().min(1).max(200).optional(),
})

interface RouteContext {
  params: Promise<{ agent: string }>
}

interface RunMetrics {
  llmCalls: number
  toolCalls: number
  promptTokens: number
  completionTokens: number
  cachedTokens: number
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { agent: agentName } = await ctx.params
  let payload: z.infer<typeof bodySchema>
  try {
    payload = bodySchema.parse(await req.json())
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Invalid body",
      },
      { status: 400 },
    )
  }

  const [orgId, user] = await Promise.all([
    getCurrentOrgId(),
    getCurrentUser(),
  ])
  const brandId = await getCurrentBrandId(orgId)

  let started
  try {
    started = await startAgentRun({
      orgId,
      userId: user.id,
      agentName,
      brandId,
      input: payload.input,
      trigger: payload.trigger,
      dedupKey: payload.dedupKey,
      override:
        payload.provider || payload.model
          ? { provider: payload.provider, model: payload.model }
          : undefined,
    })
  } catch (err) {
    /* A plan gate is not a missing resource. 402 with the structured reason
     * lets the client render an upgrade path instead of the raw JSON body it
     * used to paste into the transcript. */
    const gated = gateErrorToResult(err)
    if (gated) return Response.json(gated, { status: 402 })
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to start run",
      },
      { status: 404 },
    )
  }

  await markAgentRunStatus({
    orgId,
    runId: started.runId,
    status: "in_progress",
  })

  const metrics: RunMetrics = {
    llmCalls: 0,
    toolCalls: 0,
    promptTokens: 0,
    completionTokens: 0,
    cachedTokens: 0,
  }
  const generationIds = new Set<string>()
  const sourceUrls = new Set<string>()

  const eventStream = started.runner.runAsync({
    userId: started.userId,
    sessionId: started.sessionId,
    newMessage: started.newMessage,
    abortSignal: req.signal,
  })

  const body = eventsToSseStream(eventStream, {
    abortSignal: req.signal,
    onRawEvent: (event) =>
      collectMetrics(event, metrics, generationIds, sourceUrls),
    onFinish: async (last) => {
      const errored = last?.type === "error"
      /* An abort can surface as an error event before req.signal flips (the
       * provider SDK rejects its in-flight fetch first). Recording it as a
       * failure inflates the platform failure rate with runs nobody was
       * waiting for any more. */
      const aborted =
        req.signal.aborted || (errored && isAbortError(last.error.message))
      const status = aborted ? "cancelled" : errored ? "failed" : "succeeded"
      await markAgentRunStatus({
        orgId,
        runId: started.runId,
        status,
        metricsPatch: { ...metrics },
        generationIds: [...generationIds],
        sourceUrls: [...sourceUrls],
        error: errored
          ? {
              code: aborted ? "aborted" : "agent_error",
              message: last.error.message,
            }
          : undefined,
      })
    },
  })

  return new Response(body, {
    status: 200,
    headers: {
      ...SSE_HEADERS,
      "X-Run-Id": started.runId,
      "X-Session-Id": started.sessionId,
    },
  })
}

/* Abort reaches us as an AbortError from whichever fetch was in flight -
 * each SDK words it slightly differently. */
function isAbortError(message: string | undefined): boolean {
  return /\b(abort(ed)?|AbortError)\b/i.test(message ?? "")
}

function collectMetrics(
  event: Event,
  m: RunMetrics,
  generationIds: Set<string>,
  sourceUrls: Set<string>,
): void {
  const usage = (event as {
    usageMetadata?: {
      promptTokenCount?: number
      candidatesTokenCount?: number
      cachedContentTokenCount?: number
    }
  }).usageMetadata
  if (usage) {
    m.llmCalls += 1
    m.promptTokens += usage.promptTokenCount ?? 0
    m.completionTokens += usage.candidatesTokenCount ?? 0
    m.cachedTokens += usage.cachedContentTokenCount ?? 0
  }
  collectCustomMetadata(event, generationIds, sourceUrls)
  const parts =
    (event as { content?: { parts?: Array<{ functionCall?: unknown }> } })
      .content?.parts ?? []
  for (const p of parts) {
    if (p.functionCall) m.toolCalls += 1
  }
}

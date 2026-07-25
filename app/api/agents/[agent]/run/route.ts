import type { NextRequest } from "next/server"
import { z } from "zod"

import { getCurrentOrgId, getCurrentUser } from "@/lib/auth/server-helpers"
import { getCurrentBrandId } from "@/lib/brand/brand-session"
import { startAgentRun, markAgentRunStatus } from "@/lib/agents/triggers/manual"
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
      const status = req.signal.aborted
        ? "cancelled"
        : last?.type === "error"
          ? "failed"
          : "succeeded"
      await markAgentRunStatus({
        orgId,
        runId: started.runId,
        status,
        metricsPatch: { ...metrics },
        generationIds: [...generationIds],
        sourceUrls: [...sourceUrls],
        error:
          last?.type === "error"
            ? { code: "agent_error", message: last.error.message }
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

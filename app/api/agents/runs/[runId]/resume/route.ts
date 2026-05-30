import type { NextRequest } from "next/server"
import { z } from "zod"

import { getAdminDb } from "@/lib/firebase/admin"
import { getCurrentOrgId, getCurrentUser } from "@/lib/auth/server-helpers"
import { orgAgentRunsPath } from "@/lib/firebase/paths"
import { agentRunSchema } from "@/lib/schemas/agentRun"
import { eventsToSseStream, SSE_HEADERS } from "@/lib/agents/runtime/events"
import { resolveAgent } from "@/lib/agents"
import { AGENT_APP_NAME, buildRunner } from "@/lib/agents/runtime/runner"
import { markAgentRunStatus } from "@/lib/agents/triggers/manual"
import type { Event } from "@google/adk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/*
 * Resume a paused run by delivering a tool result for the
 * LongRunningFunctionTool that paused it (typically human-gate's
 * requestHumanApproval). The body carries the human's decision; we shape
 * it into a Content with a functionResponse part keyed by the persisted
 * toolCallId, and stream the runner's continuation as SSE - the same way
 * the original /run endpoint does.
 */

const bodySchema = z.object({
  toolCallId: z.string().min(1),
  approved: z.boolean(),
  feedback: z.string().max(4_000).optional(),
})

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ runId: string }> },
) {
  const { runId } = await ctx.params
  let payload: z.infer<typeof bodySchema>
  try {
    payload = bodySchema.parse(await req.json())
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Invalid body" },
      { status: 400 },
    )
  }

  const [orgId, user] = await Promise.all([
    getCurrentOrgId(),
    getCurrentUser(),
  ])

  const runSnap = await getAdminDb()
    .collection(orgAgentRunsPath(orgId))
    .doc(runId)
    .get()
  if (!runSnap.exists) {
    return Response.json({ ok: false, error: "Run not found" }, { status: 404 })
  }
  const runParsed = agentRunSchema.safeParse({
    ...(runSnap.data() ?? {}),
    id: runId,
    organizationId: orgId,
  })
  if (!runParsed.success) {
    return Response.json({ ok: false, error: "Run malformed" }, { status: 500 })
  }
  const run = runParsed.data

  const resolved = await resolveAgent(orgId, run.agentName)
  if (!resolved) {
    return Response.json(
      { ok: false, error: "Agent no longer registered" },
      { status: 410 },
    )
  }

  await markAgentRunStatus({
    orgId,
    runId,
    status: "in_progress",
  })

  const runner = buildRunner({ orgId, agent: resolved.agent, appName: AGENT_APP_NAME })

  /* Build the resumption message: a Content with a `functionResponse`
   * part keyed by the toolCallId the long-running tool emitted. adk-js
   * matches the response to the dangling tool call by `id`. */
  const responseBody = {
    approved: payload.approved,
    feedback: payload.feedback ?? "",
    decidedByUserId: user.id,
    decidedAt: new Date().toISOString(),
  }

  const newMessage = {
    role: "user" as const,
    parts: [
      {
        functionResponse: {
          id: payload.toolCallId,
          name: "requestHumanApproval",
          response: responseBody,
        },
      },
    ],
  }

  const metrics = {
    llmCalls: 0,
    toolCalls: 0,
    promptTokens: 0,
    completionTokens: 0,
  }

  const eventStream = runner.runAsync({
    userId: run.userId,
    sessionId: run.sessionId,
    newMessage,
    abortSignal: req.signal,
  })

  const body = eventsToSseStream(eventStream, {
    abortSignal: req.signal,
    onRawEvent: (event) => collectMetrics(event, metrics),
    onFinish: async (last) => {
      const status = req.signal.aborted
        ? "cancelled"
        : last?.type === "error"
          ? "failed"
          : "succeeded"
      await markAgentRunStatus({
        orgId,
        runId,
        status,
        metricsPatch: metrics,
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
      "X-Run-Id": runId,
      "X-Session-Id": run.sessionId,
    },
  })
}

function collectMetrics(
  event: Event,
  m: {
    llmCalls: number
    toolCalls: number
    promptTokens: number
    completionTokens: number
  },
): void {
  const usage = (event as {
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
  }).usageMetadata
  if (usage) {
    m.llmCalls += 1
    m.promptTokens += usage.promptTokenCount ?? 0
    m.completionTokens += usage.candidatesTokenCount ?? 0
  }
  const parts =
    (event as { content?: { parts?: Array<{ functionCall?: unknown }> } })
      .content?.parts ?? []
  for (const p of parts) if (p.functionCall) m.toolCalls += 1
}

import type { NextRequest } from "next/server"
import { Runner } from "@google/adk"
import type { Event, LlmRequest, LlmResponse } from "@google/adk"
import type { Content, Part } from "@google/genai"

import { AnthropicLlm } from "@/lib/agents/runtime/anthropic-llm"
import { retrieveTool } from "@/lib/agents/tools/retrieve"
import { recallTool } from "@/lib/agents/tools/memory"
import { readBrandConfigTool } from "@/lib/agents/tools/brand"
import { createDraftPostTool } from "@/lib/agents/tools/posts"
import { resolveAgent } from "@/lib/agents"
import { AGENT_APP_NAME } from "@/lib/agents/runtime/runner"
import { FirestoreSessionService } from "@/lib/agents/runtime/session-service"
import { RUNTIME_STATE_KEY, type RuntimeCtx } from "@/lib/agents/runtime/context"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SAFE_ORG_ID = "safe-foundation"

const USER_PROMPT =
  "Write a short Instagram post for World Mental Health Day on October 10, 2026. " +
  "Start by calling readBrandConfig and retrieve in parallel — for retrieve " +
  "use kind='post' and query='World Mental Health Day young people'. " +
  "Also call recall with query='mental health hooks'. Then draft the post."

const summarize = (parts: Part[] | undefined) => {
  return (parts ?? []).map((p: Part) => {
    if ("functionCall" in p && p.functionCall) {
      return {
        kind: "call" as const,
        name: p.functionCall.name,
        argsKeys: Object.keys(p.functionCall.args ?? {}),
        args: p.functionCall.args,
      }
    }
    if ("text" in p && p.text) {
      return { kind: "text" as const, textPreview: p.text.slice(0, 100) }
    }
    return { kind: "unknown" as const }
  })
}

/* Path A: direct AnthropicLlm with a manually-built LlmRequest. */
async function runDirectPath() {
  const llm = new AnthropicLlm({ model: "claude-sonnet-4-6" })
  const llmReq = {
    model: "claude-sonnet-4-6",
    contents: [
      { role: "user", parts: [{ text: USER_PROMPT }] } as Content,
    ],
    config: {
      systemInstruction:
        "You are the drafter. Call the listed tools to gather context, then draft a post via createDraftPost.",
    },
    toolsDict: {
      readBrandConfig: readBrandConfigTool,
      retrieve: retrieveTool,
      recall: recallTool,
      createDraftPost: createDraftPostTool,
    },
  } as unknown as LlmRequest

  const yields: ReturnType<typeof summarize>[] = []
  for await (const resp of llm.generateContentAsync(llmReq, false)) {
    yields.push(summarize((resp as LlmResponse).content?.parts))
  }
  return yields
}

/* Path B: full ADK Runner with the actual seeded drafter agent loaded
 * from Firestore (resolveAgent is what the real /api/agents/{agent}/run
 * route uses via startAgentRun). Identical to prod. */
async function runRunnerPath() {
  const resolved = await resolveAgent(SAFE_ORG_ID, "drafter")
  if (!resolved) {
    throw new Error("resolveAgent('drafter') returned null in diag")
  }
  const agent = resolved.agent
  const sessionService = new FirestoreSessionService(SAFE_ORG_ID)
  const runner = new Runner({
    appName: AGENT_APP_NAME,
    agent,
    sessionService,
  })

  const runtimeCtx: RuntimeCtx = {
    orgId: SAFE_ORG_ID,
    userId: "diag-user",
    runId: "diag-run",
    agentName: "drafter",
  }
  const session = await sessionService.createSession({
    appName: AGENT_APP_NAME,
    userId: "diag-user",
    sessionId: undefined,
    state: {
      [RUNTIME_STATE_KEY]: runtimeCtx,
      agentName: "drafter",
    },
  })

  const events: Array<{ author?: string; parts: ReturnType<typeof summarize> }> = []
  try {
    let count = 0
    const gen = runner.runAsync({
      userId: "diag-user",
      sessionId: session.id,
      newMessage: { role: "user", parts: [{ text: USER_PROMPT }] } as Content,
    })
    for await (const event of gen as AsyncGenerator<Event>) {
      count++
      const e = event as unknown as {
        author?: string
        content?: { parts?: Part[] }
      }
      events.push({ author: e.author, parts: summarize(e.content?.parts) })
      /* Cap at first 2 events — user + first model turn — that's all we need. */
      if (count >= 2) break
    }
  } finally {
    try {
      await sessionService.deleteSession({
        appName: AGENT_APP_NAME,
        userId: "diag-user",
        sessionId: session.id,
      })
    } catch {
      /* ignore cleanup errors */
    }
  }
  return events
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-agent-cron-secret")
  if (!secret || secret !== process.env.AGENT_CRON_SECRET) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  let directYields: ReturnType<typeof summarize>[] = []
  let directError: string | undefined
  try {
    directYields = await runDirectPath()
  } catch (err) {
    directError = err instanceof Error ? err.message : String(err)
  }

  let runnerEvents: Array<{
    author?: string
    parts: ReturnType<typeof summarize>
  }> = []
  let runnerError: string | undefined
  try {
    runnerEvents = await runRunnerPath()
  } catch (err) {
    runnerError = err instanceof Error ? err.message : String(err)
  }

  return Response.json({
    ok: !directError && !runnerError,
    nodeVersion: process.version,
    directYields,
    directError,
    runnerEvents,
    runnerError,
  })
}

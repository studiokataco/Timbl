import type { NextRequest } from "next/server"
import { z } from "zod"
import { FunctionTool } from "@google/adk"
import type { LlmRequest, LlmResponse } from "@google/adk"
import type { Content, Part } from "@google/genai"

import { AnthropicLlm } from "@/lib/agents/runtime/anthropic-llm"
import { retrieveTool } from "@/lib/agents/tools/retrieve"
import { recallTool } from "@/lib/agents/tools/memory"
import { readBrandConfigTool } from "@/lib/agents/tools/brand"
import { createDraftPostTool } from "@/lib/agents/tools/posts"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/*
 * Diagnostic endpoint — calls Anthropic with one tool and reports whether
 * functionCall.args arrives populated. Gated by the same secret as
 * /api/agents/cron/tick. Delete this file after the bug is found.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-agent-cron-secret")
  if (!secret || secret !== process.env.AGENT_CRON_SECRET) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  /* Mimic the drafter request shape: multiple real tools, parallel-call
   * prompt, system prompt long enough to trigger prompt caching. */
  const toolsDict: Record<string, unknown> = {
    readBrandConfig: readBrandConfigTool,
    retrieve: retrieveTool,
    recall: recallTool,
    createDraftPost: createDraftPostTool,
  }

  const longSystem = (
    "You are the drafter agent for SAFE Foundation, a youth mental health charity. " +
    "When given a brief you (1) gather context in parallel via readBrandConfig, " +
    "retrieve (post + awarenessDay), recall (past corrections), then (2) compose " +
    "a single warm, hopeful Instagram post in sentence case and (3) create it as " +
    "a draft via createDraftPost. Always include brief and rationale. Scheduled " +
    "date must be YYYY-MM-DD. Categories use slugs; channels are an array of " +
    "instagram|facebook|linkedin. Default postType is grid. Always cite a real " +
    "awarenessDay when one is provided in the user's request. "
  ).repeat(5) /* push system over CACHE_MIN_CHARS (4000) to trigger caching */

  const contents: Content[] = [
    {
      role: "user",
      parts: [
        {
          text:
            "Write a short Instagram post for World Mental Health Day on October 10, 2026. " +
            "Start by calling readBrandConfig and retrieve in parallel — for retrieve " +
            "use kind='post' and query='World Mental Health Day young people'. " +
            "Also call recall with query='mental health hooks'. Then draft the post.",
        },
      ],
    },
  ]
  const llmReq = {
    model: "claude-sonnet-4-6",
    contents,
    config: { systemInstruction: longSystem },
    toolsDict,
  } as unknown as LlmRequest

  const llm = new AnthropicLlm({ model: "claude-sonnet-4-6" })

  const summarize = (resp: LlmResponse) => {
    const parts = resp.content?.parts ?? []
    return parts.map((p: Part) => {
      if ("functionCall" in p && p.functionCall) {
        return {
          kind: "call",
          name: p.functionCall.name,
          argsKeys: Object.keys(p.functionCall.args ?? {}),
          args: p.functionCall.args,
        }
      }
      if ("text" in p && p.text) {
        return { kind: "text", textPreview: p.text.slice(0, 80) }
      }
      return { kind: "unknown" }
    })
  }

  const streamingYields: ReturnType<typeof summarize>[] = []
  for await (const resp of llm.generateContentAsync(llmReq, true)) {
    streamingYields.push(summarize(resp))
  }

  const nonStreamingYields: ReturnType<typeof summarize>[] = []
  for await (const resp of llm.generateContentAsync(llmReq, false)) {
    nonStreamingYields.push(summarize(resp))
  }

  return Response.json({
    ok: true,
    nodeVersion: process.version,
    streamingYields,
    nonStreamingYields,
  })
}

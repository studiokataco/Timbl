import type { NextRequest } from "next/server"
import { z } from "zod"
import { FunctionTool } from "@google/adk"
import type { LlmRequest, LlmResponse } from "@google/adk"
import type { Content, Part } from "@google/genai"

import { AnthropicLlm } from "@/lib/agents/runtime/anthropic-llm"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/*
 * Diagnostic endpoint — calls Anthropic with one tool and reports whether
 * functionCall.args arrives populated. Gated by the same secret as
 * /api/agents/cron/tick. Delete this file after the bug is found.
 */
/* One-time hardcoded token. The file (and this constant) will be deleted
 * once the diagnostic is complete; the AGENT_CRON_SECRET env binding
 * appears mismatched in prod so we can't use that here. */
const ONE_TIME_TOKEN = "def21f7b8bbe659ab2059770fb02f5193c5184d881a3f68f"

export async function GET(req: NextRequest) {
  const token = req.headers.get("x-diag-token")
  if (token !== ONE_TIME_TOKEN) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  const tool = new FunctionTool({
    name: "echoCity",
    description: "Echo back the city name the user mentions.",
    parameters: z.object({
      city: z.string().min(1).describe("The city to echo"),
      note: z.string().optional().describe("Optional note"),
    }),
    execute: async (input: { city: string; note?: string }) => ({
      ok: true,
      got: input,
    }),
  })

  const contents: Content[] = [
    {
      role: "user",
      parts: [
        {
          text:
            "Call the echoCity tool with city='Bangalore' and note='diag prod'.",
        },
      ],
    },
  ]
  const llmReq = {
    model: "claude-sonnet-4-6",
    contents,
    config: {
      systemInstruction: "You are a diagnostic helper. Always call the tool.",
    },
    toolsDict: { echoCity: tool },
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

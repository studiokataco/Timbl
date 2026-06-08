import "server-only"

import Anthropic from "@anthropic-ai/sdk"

import { runTool, TOOL_SPECS, TOOL_NAMES, type ToolName } from "./tools"

/*
 * Platform analyst. Hybrid grounding:
 *   1. Pick ONE tool + args for the question (Claude if a key is present,
 *      else a keyword router so the assistant works keyless in dev).
 *   2. Run the tool - real, bounded queries over the rollups.
 *   3. Narrate the answer strictly from the tool result. Numbers always come
 *      from step 2; the model never invents figures.
 */

const MODEL = "claude-haiku-4-5"

export interface AssistantAnswer {
  answer: string
  tool: ToolName
  data: unknown
  grounded: boolean
}

function anthropic(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY
  return apiKey ? new Anthropic({ apiKey }) : null
}

function planHeuristic(question: string): { tool: ToolName; args: Record<string, unknown> } {
  const q = question.toLowerCase()
  if (/(fail|error|broke|crash)/.test(q)) return { tool: "failing_runs", args: {} }
  if (/(revenue|mrr|margin|billing|paying)/.test(q)) return { tool: "revenue_summary", args: {} }
  if (/(model|provider)/.test(q) && /(cost|spend|spent|expensive)/.test(q))
    return { tool: "cost_by_model", args: {} }
  if (/(top|leaderboard|most|highest|biggest)/.test(q) && /(cost|spend|spent|org)/.test(q))
    return { tool: "cost_leaderboard", args: {} }
  const orgMatch = q.match(/(?:about|health|status of|for|org|organisation|organization)\s+([a-z0-9 .-]{2,})/)
  if (orgMatch) return { tool: "org_health", args: { org: orgMatch[1].trim() } }
  return { tool: "platform_summary", args: {} }
}

async function planWithLlm(
  client: Anthropic,
  question: string,
): Promise<{ tool: ToolName; args: Record<string, unknown> } | null> {
  const catalog = TOOL_SPECS.map((t) => `- ${t.name}(${t.args}): ${t.description}`).join("\n")
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    system:
      "You route a business question to exactly one analytics tool. Reply with ONLY a JSON object " +
      `{"tool": <name>, "args": <object>}. Available tools:\n${catalog}`,
    messages: [{ role: "user", content: question }],
  })
  const text = resp.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim()
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[0]) as { tool?: string; args?: Record<string, unknown> }
    if (parsed.tool && TOOL_NAMES.includes(parsed.tool as ToolName)) {
      return { tool: parsed.tool as ToolName, args: parsed.args ?? {} }
    }
  } catch {
    /* fall through to heuristic */
  }
  return null
}

async function narrateWithLlm(
  client: Anthropic,
  question: string,
  summary: string,
  data: unknown,
): Promise<string> {
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    system:
      "You are the analyst for a multi-tenant SaaS control centre. Answer the question using ONLY " +
      "the tool result provided. Never invent numbers. Be concise. If the result doesn't answer " +
      "the question, say so.",
    messages: [
      {
        role: "user",
        content: `Question: ${question}\n\nTool result summary:\n${summary}\n\nRaw data:\n${JSON.stringify(data).slice(0, 4000)}`,
      },
    ],
  })
  return resp.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim()
}

export async function askAssistant(question: string): Promise<AssistantAnswer> {
  const client = anthropic()

  const plan = (client && (await planWithLlm(client, question))) || planHeuristic(question)
  const result = await runTool(plan.tool, plan.args)

  let answer = result.summary
  if (client) {
    try {
      const narrated = await narrateWithLlm(client, question, result.summary, result.data)
      if (narrated) answer = narrated
    } catch {
      /* keep the grounded tool summary */
    }
  }

  return { answer, tool: plan.tool, data: result.data, grounded: true }
}

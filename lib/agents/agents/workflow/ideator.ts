import { GOOGLE_SEARCH, URL_CONTEXT, type LlmAgent } from "@google/adk"

import type { AgentConfig } from "@/lib/schemas/agentConfig"

import { buildLlmAgentFromConfig } from "../../runtime/build-agent"
import { listUpcomingAwarenessDaysTool } from "../../tools/awareness"
import { readBrandConfigTool } from "../../tools/brand"
import { persistIdeationTool } from "../../tools/research"
import { retrieveTool } from "../../tools/retrieve"

/*
 * Ideator - web-research-driven idea generator. Discovers awareness days,
 * trending topics, and adjacent stories the workspace could comment on, then
 * writes each discovery as an ideationFeed item with source URLs so a human
 * can verify claims before promoting to a post.
 *
 * Grounding path depends on provider: OpenRouter (default) uses the
 * web-search server tool, surfaced as citations on the run; Gemini uses its
 * first-party GOOGLE_SEARCH + URL_CONTEXT built-ins. Pointed at a provider
 * with neither (anthropic/mock), ideas come out ungrounded - keep it on
 * openrouter or gemini.
 */
export function buildIdeatorAgent(config: AgentConfig): LlmAgent {
  const geminiGrounding = config.provider === "gemini"
  return buildLlmAgentFromConfig({
    name: "ideator",
    config,
    webSearch: config.provider === "openrouter",
    tools: [
      readBrandConfigTool,
      listUpcomingAwarenessDaysTool,
      retrieveTool,
      ...(geminiGrounding ? [GOOGLE_SEARCH, URL_CONTEXT] : []),
      persistIdeationTool,
    ],
    instructionSuffix: IDEATOR_INSTRUCTION,
  })
}

const IDEATOR_INSTRUCTION = [
  "Workflow context:",
  "  - Start by reading brandConfig and listing upcoming awareness days for the next 30 days.",
  "  - Use web search to discover trending topics and recent stories adjacent to the brand's audience, and to read the most relevant articles per topic.",
  "  - Before persisting an idea, call retrieve({kind:'post', query: <idea title or summary>, k: 10}). If a high-similarity match exists (score ≥ 0.85 with the real-provider scale, or check the top-3 snippets), DROP the idea - the brand has already covered it. Quality > quantity.",
  "  - For each viable idea, call persistIdeation exactly once with:",
  "      title - punchy headline",
  "      summary - 2-3 sentences",
  "      sourceUrls - the URLs you grounded the claim in",
  "      suggestedDate - if tied to a date (e.g. awareness day), set it",
  "      awarenessDayId - if the item is anchored to a listed day, link it",
  "  - Stop after 5-7 high-quality items. Quality > quantity.",
  "  - Refuse to invent facts - every claim must trace back to a sourceUrl.",
].join("\n")

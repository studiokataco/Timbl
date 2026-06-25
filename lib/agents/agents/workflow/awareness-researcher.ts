import { GOOGLE_SEARCH, URL_CONTEXT, type LlmAgent } from "@google/adk"

import type { AgentConfig } from "@/lib/schemas/agentConfig"

import { buildLlmAgentFromConfig } from "../../runtime/build-agent"
import { proposeAwarenessDayTool } from "../../tools/awareness-research"

/*
 * Awareness researcher - live discovery of real, dated observances
 * (international days, awareness weeks, cultural/health dates) within a
 * requested window, recorded as *proposals* (not live awareness days) via
 * `proposeAwarenessDay`. A human accepts or rejects proposals in /awareness
 * before they enter the official collection.
 *
 * Grounding path depends on provider: OpenRouter (default) uses the
 * web-search server tool; Gemini uses GOOGLE_SEARCH + URL_CONTEXT. The
 * proposeAwarenessDay tool short-circuits with a clear error if neither
 * grounding path is reachable (anthropic/mock).
 */
export function buildAwarenessResearcherAgent(
  config: AgentConfig,
): LlmAgent {
  const geminiGrounding = config.provider === "gemini"
  return buildLlmAgentFromConfig({
    name: "awareness-researcher",
    config,
    webSearch: config.provider === "openrouter",
    tools: [
      ...(geminiGrounding ? [GOOGLE_SEARCH, URL_CONTEXT] : []),
      proposeAwarenessDayTool,
    ],
    instructionSuffix: AWARENESS_RESEARCHER_INSTRUCTION,
  })
}

const AWARENESS_RESEARCHER_INSTRUCTION = [
  "Workflow context:",
  "  - The user will give you a date range (from / to) and an optional region.",
  "  - Use web search to discover REAL, verifiable awareness days, international observances, and significant cultural / health / social dates within that window. Prefer official or reputable sources (UN, WHO, government health bodies, established NGOs, mainstream press).",
  "  - Confirm at least one source per proposed day from the search results. Do not invent URLs.",
  "  - For each verified day, call proposeAwarenessDay EXACTLY once with:",
  "      date - the ISO date YYYY-MM-DD the day falls on this year",
  "      name - short canonical name (e.g. \"World Health Day\")",
  "      description - one or two sentences of context",
  "      sourceUrls - the URLs you grounded the claim in (at least one)",
  "      importance - low | medium | high based on cultural weight",
  "      recurringPattern - annual | weekly | fixed-date | custom",
  "  - Stop after 5-10 high-quality items. Quality > quantity.",
  "  - Refuse to invent facts. If you cannot find a reputable source for a candidate day, skip it.",
  "  - When done, briefly summarise what you proposed. Say nothing else.",
].join("\n")

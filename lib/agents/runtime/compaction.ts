import {
  LlmSummarizer,
  TokenBasedContextCompactor,
  type BaseContextCompactor,
  type BaseLlm,
} from "@google/adk"

import type { AgentConfig } from "@/lib/schemas/agentConfig"

import { detectLlmStatus, resolveLlm } from "./llm-registry"

/*
 * Context compaction wiring for LlmAgents (see build-agent.ts).
 *
 * ADK evaluates an agent's contextCompactors before each model call; a
 * TokenBasedContextCompactor summarises the oldest events once the session
 * history crosses its token threshold, so a long run - or a draft->review
 * LoopAgent - stops re-sending the entire transcript every turn.
 *
 * The summariser runs ONLY when the threshold is crossed, so its (cheap)
 * cost is paid once to avoid re-billing a large history on every subsequent
 * turn. We always prefer the cheapest reachable model for it - Gemini Flash
 * when a Gemini key exists - regardless of the agent's own provider, since
 * the summary never ships to a user.
 */

const SUMMARIZER_MODEL_GEMINI = "gemini-2.5-flash"

function resolveSummarizerLlm(config: AgentConfig): BaseLlm | undefined {
  /* Tests / verifications run against MockLlm; summarising there would emit
   * canned junk into the history. Skip compaction entirely in that mode. */
  if (process.env.AGENT_MOCK_LLM === "1") return undefined

  const status = detectLlmStatus()
  const llm = status.gemini
    ? resolveLlm({ provider: "gemini", model: SUMMARIZER_MODEL_GEMINI })
    : resolveLlm({ provider: config.provider, model: config.model })

  // resolveLlm returns a model-name string only for paths we don't take here;
  // a string can't summarise, so treat it as "no summariser available".
  return typeof llm === "string" ? undefined : llm
}

export function makeContextCompactors(
  config: AgentConfig,
): BaseContextCompactor[] | undefined {
  if (!config.compaction.enabled) return undefined
  const summarizer = resolveSummarizerLlm(config)
  if (!summarizer) return undefined

  return [
    new TokenBasedContextCompactor({
      tokenThreshold: config.compaction.tokenThreshold,
      eventRetentionSize: config.compaction.eventRetentionSize,
      summarizer: new LlmSummarizer({ llm: summarizer }),
    }),
  ]
}

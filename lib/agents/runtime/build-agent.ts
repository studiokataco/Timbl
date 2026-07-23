import { LlmAgent } from "@google/adk"
import type { LlmAgentConfig } from "@google/adk"

import type { AgentConfig } from "@/lib/schemas/agentConfig"

import { resolveLlm } from "./llm-registry"
import { makePermissionsCallback } from "./permissions"
import { makeBudgetCallbacks } from "./budget"
import { makeContextCompactors } from "./compaction"
import { GLOBAL_OUTPUT_GUARDRAILS, INPUT_GUARDRAIL } from "./guardrails"

/*
 * Single helper every agent factory uses to instantiate its LlmAgent.
 * Centralises the boilerplate of:
 *   - resolving the LLM from agentConfig.provider/model
 *   - wiring the allowedTools permission callback
 *   - wiring per-run LLM/tool call counters from agentConfig.budgets
 *
 * Factories only need to provide the *agent-specific* bits: name,
 * description, tools, and any extra LlmAgent options. Reduces drift
 * between agents - if we change how budgets are enforced, one edit
 * propagates everywhere.
 */

export interface BuildLlmAgentInput
  extends Omit<LlmAgentConfig, "model" | "instruction"> {
  name: string
  description?: string
  config: AgentConfig
  /** Extra system text appended after agentConfig.systemPrompt - useful for
   * sub-agents in a pipeline whose role-specific instructions live in code. */
  instructionSuffix?: string
  /** Enable OpenRouter web search for this agent (research agents). Forwarded
   * to resolveLlm; a no-op unless the resolved provider is OpenRouter. */
  webSearch?: boolean
  /** Set when `tools` includes provider-native server tools. Forwarded to
   * resolveLlm to suppress cross-provider failover. */
  nativeTools?: boolean
}

export function buildLlmAgentFromConfig(
  input: BuildLlmAgentInput,
): LlmAgent {
  const { config, instructionSuffix, name, description, webSearch, nativeTools, ...rest } =
    input
  const perm = makePermissionsCallback(config.allowedTools)
  const budget = makeBudgetCallbacks(config.budgets, config.model)

  const base = instructionSuffix
    ? `${config.systemPrompt}\n\n${instructionSuffix}`
    : config.systemPrompt
  /* Guardrails go last so they win over any looser tone wording in the
   * agent's own prompt. Output guardrail stays last so it overrides tone;
   * the input guardrail precedes it. Applied to every leaf LlmAgent. */
  const instruction = `${base}\n\n${INPUT_GUARDRAIL}\n\n${GLOBAL_OUTPUT_GUARDRAILS}`

  return new LlmAgent({
    ...rest,
    name,
    description: description ?? config.description,
    model: resolveLlm({
      provider: config.provider,
      model: config.model,
      webSearch,
      nativeTools,
    }),
    instruction,
    contextCompactors: makeContextCompactors(config),
    beforeModelCallback: [budget.beforeModel],
    afterModelCallback: [budget.afterModel],
    beforeToolCallback: [budget.beforeTool, perm],
  })
}

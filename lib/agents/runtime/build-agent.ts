import { LlmAgent } from "@google/adk"
import type { LlmAgentConfig } from "@google/adk"

import type { AgentConfig } from "@/lib/schemas/agentConfig"

import { resolveLlm } from "./llm-registry"
import { makePermissionsCallback } from "./permissions"
import { makeBudgetCallbacks } from "./budget"

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
}

export function buildLlmAgentFromConfig(
  input: BuildLlmAgentInput,
): LlmAgent {
  const { config, instructionSuffix, name, description, ...rest } = input
  const perm = makePermissionsCallback(config.allowedTools)
  const budget = makeBudgetCallbacks(config.budgets)

  const instruction = instructionSuffix
    ? `${config.systemPrompt}\n\n${instructionSuffix}`
    : config.systemPrompt

  return new LlmAgent({
    ...rest,
    name,
    description: description ?? config.description,
    model: resolveLlm({ provider: config.provider, model: config.model }),
    instruction,
    beforeModelCallback: [budget.beforeModel],
    beforeToolCallback: [budget.beforeTool, perm],
  })
}

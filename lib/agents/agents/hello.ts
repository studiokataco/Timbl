import type { LlmAgent } from "@google/adk"

import type { AgentConfig } from "@/lib/schemas/agentConfig"

import { buildLlmAgentFromConfig } from "../runtime/build-agent"

/*
 * Diagnostic echo agent - used to smoke the runtime end to end. Model,
 * provider, prompt all come from agentConfigs/hello.
 */
export function buildHelloAgent(config: AgentConfig): LlmAgent {
  return buildLlmAgentFromConfig({
    name: "hello",
    config,
  })
}

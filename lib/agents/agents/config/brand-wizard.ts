import type { LlmAgent } from "@google/adk"

import type { AgentConfig } from "@/lib/schemas/agentConfig"

import { buildLlmAgentFromConfig } from "../../runtime/build-agent"
import {
  readBrandConfigTool,
  writeBrandConfigTool,
} from "../../tools/brand"

export function buildBrandWizardAgent(config: AgentConfig): LlmAgent {
  return buildLlmAgentFromConfig({
    name: "brand-wizard",
    config,
    tools: [readBrandConfigTool, writeBrandConfigTool],
  })
}

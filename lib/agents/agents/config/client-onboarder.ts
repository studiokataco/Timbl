import type { LlmAgent } from "@google/adk"

import type { AgentConfig } from "@/lib/schemas/agentConfig"

import { buildLlmAgentFromConfig } from "../../runtime/build-agent"
import { readBrandConfigTool, writeBrandConfigTool } from "../../tools/brand"
import { rememberTool } from "../../tools/memory"
import { createDraftPostTool } from "../../tools/posts"
import { createTemplateTool } from "../../tools/templates"

export function buildClientOnboarderAgent(config: AgentConfig): LlmAgent {
  return buildLlmAgentFromConfig({
    name: "client-onboarder",
    config,
    tools: [
      readBrandConfigTool,
      writeBrandConfigTool,
      createDraftPostTool,
      createTemplateTool,
      rememberTool,
    ],
  })
}

import type { LlmAgent } from "@google/adk"

import type { AgentConfig } from "@/lib/schemas/agentConfig"

import { buildLlmAgentFromConfig } from "../../runtime/build-agent"
import {
  readAgentConfigTool,
  proposeAgentConfigChangeTool,
} from "../../tools/agent-admin"

/*
 * Meta-config agent — proposes prompt / model / temperature / budget
 * changes to other agents based on a human's brief. Outputs proposals into
 * /agentConfigProposals; nothing is applied until a human approves in
 * /settings/agents.
 */
export function buildMetaConfigAgent(config: AgentConfig): LlmAgent {
  return buildLlmAgentFromConfig({
    name: "meta-config",
    config,
    tools: [readAgentConfigTool, proposeAgentConfigChangeTool],
  })
}

import type { LlmAgent } from "@google/adk"

import type { AgentConfig } from "@/lib/schemas/agentConfig"

import { buildLlmAgentFromConfig } from "../../runtime/build-agent"
import {
  readBrandConfigTool,
  writeBrandConfigTool,
} from "../../tools/brand"
import {
  readAgentConfigTool,
  proposeAgentConfigChangeTool,
} from "../../tools/agent-admin"

/*
 * Lives behind the global agent drawer (Cmd-J). A general-purpose
 * configuration assistant — reads brand config, drafts changes, and can
 * propose tweaks to other agents' configs (proposals require human
 * approval; the assistant never silently rewrites another agent's prompt).
 */
export function buildSettingsAssistantAgent(config: AgentConfig): LlmAgent {
  return buildLlmAgentFromConfig({
    name: "settings-assistant",
    config,
    tools: [
      readBrandConfigTool,
      writeBrandConfigTool,
      readAgentConfigTool,
      proposeAgentConfigChangeTool,
    ],
  })
}

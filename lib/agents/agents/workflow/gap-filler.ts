import type { LlmAgent } from "@google/adk"

import type { AgentConfig } from "@/lib/schemas/agentConfig"

import { buildLlmAgentFromConfig } from "../../runtime/build-agent"
import { readBrandConfigTool } from "../../tools/brand"
import {
  findOpenSlotsTool,
  listEventsTool,
} from "../../tools/calendar"
import {
  listPostsTool,
  createDraftPostTool,
} from "../../tools/posts"

export function buildGapFillerAgent(config: AgentConfig): LlmAgent {
  return buildLlmAgentFromConfig({
    name: "gap-filler",
    config,
    tools: [
      readBrandConfigTool,
      findOpenSlotsTool,
      listEventsTool,
      listPostsTool,
      createDraftPostTool,
    ],
    instructionSuffix: GAP_FILLER_INSTRUCTION,
  })
}

const GAP_FILLER_INSTRUCTION = [
  "Workflow context:",
  "  - Call readBrandConfig to load targetCadence (perWeek, preferredDays, preferredTimes).",
  "  - Call findOpenSlots with a 14-day window from today, passing the cadence preferences.",
  "  - Call listPosts to understand what topics are already covered in the window - avoid repeating.",
  "  - For each open slot that the cadence expects to be filled, call createDraftPost with a clear brief and a topic that suits the brand's audience and any nearby events.",
  "  - Set reviewState='pending' on every draft.",
  "  - Reply with a short summary: how many gaps you found, how many you filled, and the date range.",
].join("\n")

import type { LlmAgent } from "@google/adk"

import type { AgentConfig } from "@/lib/schemas/agentConfig"

import { buildLlmAgentFromConfig } from "../../runtime/build-agent"
import { readBrandConfigTool } from "../../tools/brand"
import {
  findOpenSlotsTool,
  listEventsTool,
  scheduleDraftTool,
} from "../../tools/calendar"

/*
 * Scheduler — picks a slot for an already-approved draft. Reads:
 *   - the brand's targetCadence (for preferred days/times)
 *   - upcoming events (to avoid double-booking)
 *   - existing posts in the window (via findOpenSlots' excludeAlreadyScheduled)
 *
 * Then calls scheduleDraft on the post in session state's `lastDraftPostId`.
 *
 * Never invent dates by hand — only pick from findOpenSlots' return value.
 */
export function buildSchedulerAgent(config: AgentConfig): LlmAgent {
  return buildLlmAgentFromConfig({
    name: "scheduler",
    config,
    tools: [
      readBrandConfigTool,
      listEventsTool,
      findOpenSlotsTool,
      scheduleDraftTool,
    ],
    instructionSuffix: SCHEDULER_INSTRUCTION,
  })
}

const SCHEDULER_INSTRUCTION = [
  "Workflow context:",
  "  - Use readBrandConfig to read targetCadence (preferred days / times / perWeek).",
  "  - Use listEvents over the next 30 days to identify conflicts.",
  "  - Call findOpenSlots once with the cadence preferences, then PICK ONE slot from its results.",
  "  - Never invent dates of your own — pick from findOpenSlots only.",
  "  - Call scheduleDraft with the chosen postId, date, and (optional) time.",
  "  - Be terse — one short message explaining the chosen slot is enough.",
].join("\n")

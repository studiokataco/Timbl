import type { LlmAgent } from "@google/adk"

import type { AgentConfig } from "@/lib/schemas/agentConfig"

import { buildLlmAgentFromConfig } from "../../runtime/build-agent"
import { readBrandConfigTool } from "../../tools/brand"
import {
  findOpenSlotsTool,
  listEventsTool,
} from "../../tools/calendar"
import {
  createDraftPostTool,
  listPostsTool,
} from "../../tools/posts"
import { listUpcomingAwarenessDaysTool } from "../../tools/awareness"

/*
 * Cadence-planner — bulk-drafts a posting plan for an upcoming window
 * (typically a week or month). One run produces N drafts; each draft has
 * agentMeta.reviewState='pending' so humans approve through the standard
 * kanban affordance.
 *
 * Triggered by the calendar toolbar's "Plan cadence" button with the
 * date range as the input prompt; also schedulable via cron for
 * routine weekly planning.
 */
export function buildCadencePlannerAgent(config: AgentConfig): LlmAgent {
  return buildLlmAgentFromConfig({
    name: "cadence-planner",
    config,
    tools: [
      readBrandConfigTool,
      listEventsTool,
      listUpcomingAwarenessDaysTool,
      findOpenSlotsTool,
      listPostsTool,
      createDraftPostTool,
    ],
    instructionSuffix: CADENCE_INSTRUCTION,
  })
}

const CADENCE_INSTRUCTION = [
  "Workflow context:",
  "  - Read brandConfig.targetCadence (perWeek, preferredDays, preferredTimes).",
  "  - Call findOpenSlots with the user-supplied date range and the cadence preferences.",
  "  - For each returned slot, decide a topic — combine awareness days, brand priorities, and existing posts (use listPosts to avoid repeating).",
  "  - Call createDraftPost once per slot. Set status='idea', reviewState='pending', and include a clear `brief`.",
  "  - Be terse in your final reply: just summarise how many drafts you created and the date range.",
].join("\n")

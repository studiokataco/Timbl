import type { LlmAgent } from "@google/adk"

import type { AgentConfig } from "@/lib/schemas/agentConfig"

import { buildLlmAgentFromConfig } from "../../runtime/build-agent"
import { readBrandConfigTool } from "../../tools/brand"
import { recallTool } from "../../tools/memory"
import { listPostsTool } from "../../tools/posts"

export function buildBrandAuditorAgent(config: AgentConfig): LlmAgent {
  return buildLlmAgentFromConfig({
    name: "brand-auditor",
    config,
    tools: [readBrandConfigTool, listPostsTool, recallTool],
    instructionSuffix: BRAND_AUDITOR_INSTRUCTION,
  })
}

const BRAND_AUDITOR_INSTRUCTION = [
  "Workflow context:",
  "  - Start by calling readBrandConfig to load voice, audience, and forbiddenTopics.",
  "  - Call listPosts with reviewState='approved' to get the 20 most recent approved or published posts.",
  "  - For each post, judge it against the brand rules: tone consistency, audience fit, forbidden topics.",
  "  - Call recall({query: 'brand audit findings', k: 5}) to check prior audit history before flagging the same issues again.",
  "  - Report your findings: list each drifting post by id, quote the offending phrase, and state which rule it breaks.",
  "  - If everything is on-brand, say so plainly in one sentence.",
  "  - End with a 1-2 sentence overall verdict and any actionable recommendation.",
].join("\n")

import type { LlmAgent } from "@google/adk"

import type { AgentConfig } from "@/lib/schemas/agentConfig"

import { buildLlmAgentFromConfig } from "../../runtime/build-agent"
import { readBrandConfigTool } from "../../tools/brand"
import { recallTool } from "../../tools/memory"
import {
  listPostsTool,
  createDraftPostTool,
} from "../../tools/posts"
import { retrieveTool } from "../../tools/retrieve"

export function buildRepurposerAgent(config: AgentConfig): LlmAgent {
  return buildLlmAgentFromConfig({
    name: "repurposer",
    config,
    tools: [
      readBrandConfigTool,
      listPostsTool,
      recallTool,
      retrieveTool,
      createDraftPostTool,
    ],
    instructionSuffix: REPURPOSER_INSTRUCTION,
  })
}

const REPURPOSER_INSTRUCTION = [
  "Workflow context:",
  "  - Call readBrandConfig to load voice, audience, and forbidden topics.",
  "  - Call listPosts with approvedOnly=true to find approved content. Look for posts over 90 days old that performed well or cover evergreen themes.",
  "  - Call recall to check if a variant of the chosen source post was published recently - skip if it was.",
  "  - Call retrieve({kind:'post', query: <source topic>, k: 5, approvedOnly: true}) to surface related content to avoid duplicating.",
  "  - For each source post you mine, call createDraftPost with a genuinely fresh take: new hook, reframed angle, or updated context. Never copy the source blurb verbatim.",
  "  - Set reviewState='pending' on every draft so a human approves before it publishes.",
  "  - Aim for 2-3 drafts per run. Summarise: which posts you mined and what angle you took.",
].join("\n")

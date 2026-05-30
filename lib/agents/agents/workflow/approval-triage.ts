import type { LlmAgent } from "@google/adk"

import type { AgentConfig } from "@/lib/schemas/agentConfig"

import { buildLlmAgentFromConfig } from "../../runtime/build-agent"
import { listPostsTool, updateDraftPostTool } from "../../tools/posts"

/*
 * Approval-triage - periodically scans posts with agentMeta.reviewState=
 * 'pending' and surfaces ones stuck > 48h. Doesn't auto-approve; just
 * leaves a short note in agentMeta.rationale prefixed "[triage] …" so
 * humans see it and can react.
 */
export function buildApprovalTriageAgent(config: AgentConfig): LlmAgent {
  return buildLlmAgentFromConfig({
    name: "approval-triage",
    config,
    tools: [listPostsTool, updateDraftPostTool],
    instructionSuffix: TRIAGE_INSTRUCTION,
  })
}

const TRIAGE_INSTRUCTION = [
  "Workflow context:",
  "  - Call listPosts with onlyAgentDrafts=true and look at agentMeta.reviewState.",
  "  - For any draft whose scheduledDate is within the next 3 days AND whose reviewState is 'pending', call updateDraft to prepend '[triage] reminder: …' to rationale.",
  "  - Reply with a short summary: how many drafts need attention and which dates.",
].join("\n")

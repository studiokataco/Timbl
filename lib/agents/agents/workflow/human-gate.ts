import type { LlmAgent } from "@google/adk"

import type { AgentConfig } from "@/lib/schemas/agentConfig"

import { buildLlmAgentFromConfig } from "../../runtime/build-agent"
import { requestHumanApprovalTool } from "../../tools/human-gate"
import { listPostsTool } from "../../tools/posts"

/*
 * Human-gate sub-agent — sole job is to invoke the long-running
 * requestHumanApproval tool on the current draft. The pipeline pauses
 * here until the human acts via /api/agents/runs/{runId}/resume.
 *
 * Why an agent rather than calling the tool directly: SequentialAgent
 * composes BaseAgent instances, not tools. Wrapping the tool in a one-
 * shot LlmAgent lets it plug into the pipeline naturally.
 */
export function buildHumanGateAgent(config: AgentConfig): LlmAgent {
  return buildLlmAgentFromConfig({
    name: "human-gate",
    config,
    tools: [listPostsTool, requestHumanApprovalTool],
    instructionSuffix: HUMAN_GATE_INSTRUCTION,
  })
}

const HUMAN_GATE_INSTRUCTION = [
  "Workflow context:",
  "  - The session state contains `lastDraftPostId`.",
  "  - Briefly summarise the draft (one sentence: who, what, when) — read it via listPosts if you need details.",
  "  - Then call requestHumanApproval with the postId and that one-sentence summary.",
  "  - That tool intentionally never returns. The run pauses here; do not say anything else after the tool call.",
].join("\n")

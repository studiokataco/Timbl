import { EXIT_LOOP, type LlmAgent } from "@google/adk"

import type { AgentConfig } from "@/lib/schemas/agentConfig"
import { CHANNEL_RULES } from "@/lib/publishing/rules"

import { buildLlmAgentFromConfig } from "../../runtime/build-agent"
import { readBrandConfigTool } from "../../tools/brand"
import { recallTool } from "../../tools/memory"
import {
  listPostsTool,
  updateDraftPostTool,
} from "../../tools/posts"

/*
 * Reviewer - reads the latest draft, checks it against brandConfig + the
 * brand's forbidden topics, and either:
 *
 *   - calls EXIT_LOOP if the draft is publishable, OR
 *   - emits a concrete critique string and updates the draft's `rationale`
 *     field with that critique so the next drafter iteration has context.
 *
 * Reviewer never mutates the blurb/brief directly - that's drafter's job.
 * Reviewer's only writes are critique text into agentMeta.rationale (so the
 * UI can show "AI review: X").
 */
export function buildReviewerAgent(config: AgentConfig): LlmAgent {
  return buildLlmAgentFromConfig({
    name: "reviewer",
    config,
    tools: [readBrandConfigTool, recallTool, listPostsTool, updateDraftPostTool, EXIT_LOOP],
    instructionSuffix: REVIEWER_INSTRUCTION,
  })
}

/* Compact per-channel publish limits so the reviewer fails drafts that would
 * be rejected at the publish API boundary. Sourced from the publishing layer
 * so there's one source of truth. */
const PUBLISH_RULES_CONTEXT =
  "Per-channel publish limits - fail a draft that violates the limit for any channel it targets: " +
  Object.entries(CHANNEL_RULES)
    .map(([ch, r]) => {
      const parts: string[] = []
      if (r.maxTextLength) parts.push(`≤${r.maxTextLength} chars`)
      if (r.mediaRequired) parts.push("media required")
      if (r.maxImages !== undefined) parts.push(`≤${r.maxImages} images`)
      if (r.maxVideos !== undefined) parts.push(`≤${r.maxVideos} video`)
      if (r.allowsMixedMedia === false) parts.push("no mixed image+video")
      return parts.length ? `${ch}: ${parts.join(", ")}` : null
    })
    .filter(Boolean)
    .join("; ")

const REVIEWER_INSTRUCTION = [
  "Workflow context:",
  "  - The session state contains `lastDraftPostId`. Read that post via listPosts (or use a previous turn's content).",
  "  - Read the brand config and judge whether the draft is publishable against voice + forbiddenTopics.",
  "  - Before critiquing, call recall({query: <draft blurb>, k: 5}) and PREFER applying a remembered correction over re-raising it. If a prior memory already covers the issue, your critique should reference it briefly.",
  `  - ${PUBLISH_RULES_CONTEXT}`,
  "  - If publishable: call EXIT_LOOP. Do NOT add more commentary.",
  "  - If not publishable: produce ONE focused critique (≤200 words) describing what to change, and call updateDraft to set agentMeta.rationale to that critique. Do not edit the blurb yourself.",
  "  - Always set agentMeta.reviewState='pending'. Final approval is a separate human step.",
].join("\n")

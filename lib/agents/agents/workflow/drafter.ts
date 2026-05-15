import type { LlmAgent } from "@google/adk"

import type { AgentConfig } from "@/lib/schemas/agentConfig"

import { buildLlmAgentFromConfig } from "../../runtime/build-agent"
import { readBrandConfigTool } from "../../tools/brand"
import {
  createDraftPostTool,
  updateDraftPostTool,
} from "../../tools/posts"

/*
 * Drafter — produces a post draft and writes it as a Firestore Post doc
 * with agentMeta.sourceAgent="drafter" and reviewState="pending".
 *
 * Inside a LoopAgent, on the second+ iteration the drafter looks for
 * `state.lastDraftPostId` and `state.critique`; when present, it calls
 * updateDraft instead of createDraftPost so the same Post is iterated on
 * rather than spawning multiple drafts.
 *
 * The drafter must always pull the latest brandConfig before writing — a
 * brand patch made between turns is part of the input it must respect.
 */
export function buildDrafterAgent(config: AgentConfig): LlmAgent {
  return buildLlmAgentFromConfig({
    name: "drafter",
    config,
    tools: [readBrandConfigTool, createDraftPostTool, updateDraftPostTool],
    instructionSuffix: DRAFTER_INSTRUCTION,
  })
}

const DRAFTER_INSTRUCTION = [
  "Workflow context:",
  "  - You sit inside a draft-review loop. On the FIRST iteration there is no prior draft; create one with createDraftPost.",
  "  - On LATER iterations, the session state may contain `lastDraftPostId` and `critique`. If they exist, call updateDraft on that post id, applying the critique to revise the blurb / brief / hashtags.",
  "  - Always start a turn by calling readBrandConfig so your voice and forbidden topics are current.",
  "  - Persist the chosen draft post id into session state under `lastDraftPostId` (via your tool's output — the runner records this automatically).",
].join("\n")

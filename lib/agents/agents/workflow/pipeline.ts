import { LoopAgent, SequentialAgent, type BaseAgent } from "@google/adk"

import type { AgentConfig } from "@/lib/schemas/agentConfig"

import type { FactoryHelpers } from "../.."

/*
 * Workflow pipeline:
 *
 *   SequentialAgent([
 *     LoopAgent([drafter, reviewer], maxIterations=N),
 *     human-gate,
 *     scheduler,
 *   ])
 *
 * - LoopAgent keeps re-running drafter→reviewer until reviewer calls
 *   EXIT_LOOP (the canonical adk-js EXIT_LOOP tool) or until N iterations
 *   have passed.
 * - Reviewer never edits the blurb; the drafter consumes the critique on
 *   the next iteration via `state.lastDraftPostId` + `agentMeta.rationale`.
 * - human-gate calls the LongRunningFunctionTool, which pauses the run
 *   until /api/agents/runs/{runId}/resume delivers the human's decision.
 * - scheduler picks a slot from findOpenSlots and writes scheduledDate.
 *
 * `maxIterations` comes from the pipeline agent's own budget
 * (maxReviewLoops) so it's tunable per org without touching code.
 */
export async function buildPipelineAgent(
  config: AgentConfig,
  helpers: FactoryHelpers,
): Promise<BaseAgent> {
  const [drafter, reviewer, humanGate, scheduler] = await Promise.all([
    helpers.resolveByName("drafter"),
    helpers.resolveByName("reviewer"),
    helpers.resolveByName("human-gate"),
    helpers.resolveByName("scheduler"),
  ])

  const missing: string[] = []
  if (!drafter) missing.push("drafter")
  if (!reviewer) missing.push("reviewer")
  if (!humanGate) missing.push("human-gate")
  if (!scheduler) missing.push("scheduler")
  if (missing.length > 0) {
    throw new Error(
      `Pipeline cannot be constructed — missing sub-agents: ${missing.join(", ")}. Seed agentConfigs for these names.`,
    )
  }

  const reviewLoop = new LoopAgent({
    name: "review-loop",
    description: "Iterate drafter→reviewer until reviewer is satisfied.",
    maxIterations: config.budgets.maxReviewLoops || 3,
    subAgents: [drafter!, reviewer!],
  })

  return new SequentialAgent({
    name: "pipeline",
    description: config.description ?? "Ideation → draft → review → human → schedule.",
    subAgents: [reviewLoop, humanGate!, scheduler!],
  })
}

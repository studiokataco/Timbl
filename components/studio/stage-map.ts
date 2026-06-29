/*
 * Mapping from agent name → conceptual pipeline stage.
 *
 * The Studio's left rail and pipeline graph both group agents by these
 * five product stages plus a CONFIG meta-stage and an OTHER fallback.
 * Centralising the map here keeps the roster + pipeline-graph in sync.
 */
export type Stage =
  | "PLAN"
  | "DRAFT"
  | "REVIEW"
  | "SCHEDULE"
  | "GATE"
  | "CONFIG"
  | "OTHER"

export const STAGES: Stage[] = [
  "PLAN",
  "DRAFT",
  "REVIEW",
  "SCHEDULE",
  "GATE",
  "CONFIG",
  "OTHER",
]

export const PIPELINE_STAGES = [
  { key: "PLAN", label: "Plan" },
  { key: "DRAFT", label: "Draft" },
  { key: "REVIEW", label: "Review" },
  { key: "SCHEDULE", label: "Schedule" },
  { key: "PUBLISH", label: "Publish" },
] as const

export type PipelineStageKey = (typeof PIPELINE_STAGES)[number]["key"]

const NAME_TO_STAGE: Record<string, Stage> = {
  ideator: "PLAN",
  "cadence-planner": "PLAN",
  "awareness-researcher": "PLAN",
  "gap-filler": "PLAN",
  research: "PLAN",

  drafter: "DRAFT",
  repurposer: "DRAFT",

  reviewer: "REVIEW",
  "approval-triage": "REVIEW",
  "brand-auditor": "REVIEW",

  scheduler: "SCHEDULE",

  "human-gate": "GATE",

  "brand-wizard": "CONFIG",
  "meta-config": "CONFIG",
  "settings-assistant": "CONFIG",
  "client-onboarder": "CONFIG",
}

export function stageForAgent(name: string): Stage {
  return NAME_TO_STAGE[name] ?? "OTHER"
}

/**
 * Pipeline-graph counts come from runs, not the agent roster. A run's
 * agent maps onto a pipeline-stage card. GATE/CONFIG don't get their own
 * card on the 5-stage flow - gate folds into REVIEW conceptually, config
 * is invisible to the pipeline graph.
 */
export function pipelineStageForAgent(name: string): PipelineStageKey | null {
  const s = stageForAgent(name)
  switch (s) {
    case "PLAN":
      return "PLAN"
    case "DRAFT":
      return "DRAFT"
    case "REVIEW":
    case "GATE":
      return "REVIEW"
    case "SCHEDULE":
      return "SCHEDULE"
    default:
      return null
  }
}

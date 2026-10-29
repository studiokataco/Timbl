export type Stage =
  | "PLAN"
  | "DRAFT"
  | "REVIEW"
  | "SCHEDULE"
  | "GATE"
  | "CONFIG"
  | "OTHER"

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

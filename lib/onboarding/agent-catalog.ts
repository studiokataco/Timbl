/*
 * Wizard-selectable agent catalog.
 *
 * The onboarding wizard's "Pick your AI agents" step renders this list, and
 * `applyOnboardingSelections` toggles the matching agentConfig docs. Every
 * id here MUST be a real agent in `lib/agents/defaults.ts` (and therefore
 * registered in `lib/agents/index.ts:FACTORIES`) - otherwise the toggle
 * writes `enabled` onto a doc the ADK runtime has no factory to run.
 *
 * Deliberately excluded: the config agents (hello, brand-wizard,
 * settings-assistant, meta-config) and the pipeline machinery (pipeline,
 * reviewer, scheduler, human-gate). Those are always-on infrastructure -
 * seeded `enabled: true` and never surfaced as a user toggle, because
 * disabling a pipeline sub-agent would silently break the review loop.
 */

export interface WizardAgent {
  id: string
  label: string
  description: string
}

export const WIZARD_AGENT_CATALOG: WizardAgent[] = [
  {
    id: "drafter",
    label: "Drafter",
    description: "Writes post drafts from a brief or category cadence.",
  },
  {
    id: "ideator",
    label: "Ideator",
    description: "Discovers post ideas from web research and awareness days.",
  },
  {
    id: "cadence-planner",
    label: "Cadence planner",
    description: "Plans a balanced posting calendar across a date range.",
  },
  {
    id: "approval-triage",
    label: "Approval triage",
    description: "Nudges drafts whose schedule is near but still unreviewed.",
  },
  {
    id: "awareness-researcher",
    label: "Awareness researcher",
    description: "Finds awareness days, observances, and cultural moments.",
  },
]

/* Ids only - handy for default-selection sets and membership checks. */
export const WIZARD_AGENT_IDS: string[] = WIZARD_AGENT_CATALOG.map((a) => a.id)

export function isWizardSelectableAgent(id: string): boolean {
  return WIZARD_AGENT_IDS.includes(id)
}

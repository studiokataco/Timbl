import { AGENT_DEFAULTS, type AgentDefault } from "./defaults"

/*
 * Client-safe summary of the agent template registry. Excludes the
 * full systemPrompt so the page bundle stays small - the prompt is
 * fetched on demand by the `getAgentTemplate` server action when the
 * user opens the "Customize" panel in the Add-agent sheet.
 */

export interface AgentTemplate {
  name: string
  role: AgentDefault["role"]
  description: string
  provider: AgentDefault["provider"]
  model: string
  temperature: number
  /** Truncated preview - the full prompt loads when the user customizes. */
  promptPreview: string
  schedule?: string
  allowedTools: string[]
  boutique?: boolean
  label?: string
  /** Short, plain-language one-liner for the install card. */
  tagline?: string
}

/* Plain one-liners for the Add-agent cards. The domain `description` on
 * each default is written for config/runtime context and reads too
 * technical here; this is the customer-facing line. */
const TAGLINES: Record<string, string> = {
  ideator: "Finds fresh post ideas from the web and awareness days.",
  "cadence-planner": "Plans a balanced posting schedule for any date range.",
  "awareness-researcher":
    "Discovers awareness days and cultural moments to post about.",
  "gap-filler": "Fills empty slots in your calendar with draft posts.",
  drafter: "Writes on-brand post drafts from a brief.",
  repurposer: "Turns your best past posts into fresh new drafts.",
  "approval-triage": "Nudges drafts that are due but still unreviewed.",
  "brand-auditor": "Checks recent posts for off-brand drift.",
}

export const AGENT_TEMPLATES: AgentTemplate[] = AGENT_DEFAULTS.map((d) => ({
  name: d.name,
  role: d.role,
  description: d.description,
  provider: d.provider,
  model: d.model,
  temperature: d.temperature,
  promptPreview:
    d.systemPrompt.length > 220
      ? d.systemPrompt.slice(0, 220).trimEnd() + "…"
      : d.systemPrompt,
  schedule: d.schedule,
  allowedTools: d.allowedTools,
  boutique: d.boutique ?? false,
  label: d.label,
  tagline: TAGLINES[d.name],
}))

export const BOUTIQUE_TEMPLATES: AgentTemplate[] = AGENT_TEMPLATES.filter(
  (t) => t.boutique === true,
)

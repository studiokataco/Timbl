import { AGENT_DEFAULTS, type AgentDefault } from "./defaults"

/*
 * Client-safe summary of the agent template registry. Excludes the
 * full systemPrompt so the page bundle stays small — the prompt is
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
  /** Truncated preview — the full prompt loads when the user customizes. */
  promptPreview: string
  schedule?: string
  allowedTools: string[]
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
}))

/*
 * Wizard-selectable agent catalog.
 *
 * Agents marked boutique:true in lib/agents/defaults.ts appear in the
 * onboarding wizard and Studio roster. Infra agents (config, pipeline
 * machinery) are excluded automatically because they lack the flag.
 */

import { boutiqueAgentDefaults, isBoutiqueAgent } from "@/lib/agents/defaults"

export interface WizardAgent {
  id: string
  label: string
  description: string
}

export const WIZARD_AGENT_CATALOG: WizardAgent[] = boutiqueAgentDefaults().map((d) => ({
  id: d.name,
  label: d.label ?? d.name,
  description: d.description,
}))

export const WIZARD_AGENT_IDS: string[] = WIZARD_AGENT_CATALOG.map((a) => a.id)

export function isWizardSelectableAgent(id: string): boolean {
  return WIZARD_AGENT_IDS.includes(id)
}

export function isStudioHiddenAgent(id: string): boolean {
  return !isBoutiqueAgent(id)
}

export function agentsForStudioRoster<T extends { name: string; enabled: boolean }>(
  agents: T[],
): T[] {
  return agents.filter((a) => a.enabled && isBoutiqueAgent(a.name))
}

export const DEFAULT_CHAT_AGENT_ID = "drafter"

export function rosterAgentNames<T extends { name: string; enabled: boolean }>(
  agents: T[],
): string[] {
  return agentsForStudioRoster(agents).map((a) => a.name)
}

export function defaultChatAgentId<T extends { name: string; enabled: boolean }>(
  agents: T[],
): string {
  return rosterAgentNames(agents)[0] ?? DEFAULT_CHAT_AGENT_ID
}

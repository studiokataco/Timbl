import type { BaseAgent } from "@google/adk"

import type { AgentConfig } from "@/lib/schemas/agentConfig"

import type { FactoryHelpers } from "../.."
import { buildLlmAgentFromConfig } from "../../runtime/build-agent"
import { readBrandConfigTool, writeBrandConfigTool } from "../../tools/brand"

export async function buildBrandWizardAgent(
  config: AgentConfig,
  helpers: FactoryHelpers,
): Promise<BaseAgent> {
  /* client-onboarder is a boutique add-on - only wire the handoff when the
   * org has actually installed it. Without it, brand-wizard runs standalone. */
  const onboarder = await helpers.resolveByName("client-onboarder")

  return buildLlmAgentFromConfig({
    name: "brand-wizard",
    config,
    tools: [readBrandConfigTool, writeBrandConfigTool],
    subAgents: onboarder ? [onboarder] : undefined,
    instructionSuffix: onboarder ? BRAND_WIZARD_DELEGATION : undefined,
  })
}

const BRAND_WIZARD_DELEGATION = [
  "Handoff:",
  "  - A dedicated client onboarding agent ('client-onboarder') can take a brand-new client from zero: it captures the full brief and then seeds a starter week of drafts, which you do not do.",
  "  - If the user is setting up a brand-new client from scratch or wants the full kickoff rather than editing one field, do not start interviewing. First ask permission, in one sentence: would they like you to hand this to the client onboarding agent, which captures the brief and seeds a starter week of drafts.",
  "  - Only after the user clearly agrees, call transfer_to_agent with agent name 'client-onboarder'. If they decline or only want to tweak existing fields, continue the brand interview yourself.",
  "  - Never call transfer_to_agent without explicit permission in the user's reply.",
].join("\n")

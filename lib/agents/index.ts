import type { BaseAgent, LlmAgent } from "@google/adk"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgAgentConfigsPath } from "@/lib/firebase/paths"
import {
  agentConfigSchema,
  type AgentConfig,
  type AgentProvider,
} from "@/lib/schemas/agentConfig"

import { buildHelloAgent } from "./agents/hello"
import { buildBrandWizardAgent } from "./agents/config/brand-wizard"
import { buildSettingsAssistantAgent } from "./agents/config/settings-assistant"
import { buildMetaConfigAgent } from "./agents/config/meta-config"
import { buildClientOnboarderAgent } from "./agents/config/client-onboarder"
import { buildDrafterAgent } from "./agents/workflow/drafter"
import { buildReviewerAgent } from "./agents/workflow/reviewer"
import { buildSchedulerAgent } from "./agents/workflow/scheduler"
import { buildHumanGateAgent } from "./agents/workflow/human-gate"
import { buildIdeatorAgent } from "./agents/workflow/ideator"
import { buildPipelineAgent } from "./agents/workflow/pipeline"
import { buildCadencePlannerAgent } from "./agents/workflow/cadence-planner"
import { buildApprovalTriageAgent } from "./agents/workflow/approval-triage"
import { buildAwarenessResearcherAgent } from "./agents/workflow/awareness-researcher"
import { buildRepurposerAgent } from "./agents/workflow/repurposer"
import { buildGapFillerAgent } from "./agents/workflow/gap-filler"
import { buildBrandAuditorAgent } from "./agents/workflow/brand-auditor"

/*
 * Agent factory registry. Each entry is either:
 *   - SyncFactory(config) → leaf LlmAgent
 *   - AsyncFactory(config, helpers) → composite agent that resolves sub-
 *     agents at build time via helpers.resolveByName().
 *
 * Editing an agentConfig in /settings/agents takes effect on the next run.
 *
 * To add a new agent:
 *   1. Implement a builder.
 *   2. Register it in FACTORIES below.
 *   3. Seed a default AgentConfig in firestore/seeds/0007_agent_configs.ts.
 */

export interface FactoryHelpers {
  resolveByName: (name: string) => Promise<BaseAgent | null>
}

type SyncFactory = (config: AgentConfig) => BaseAgent | LlmAgent
type AsyncFactory = (
  config: AgentConfig,
  helpers: FactoryHelpers,
) => Promise<BaseAgent>

type AnyFactory = SyncFactory | AsyncFactory

const FACTORIES: Record<string, AnyFactory> = {
  hello: buildHelloAgent,
  "brand-wizard": buildBrandWizardAgent,
  "settings-assistant": buildSettingsAssistantAgent,
  "meta-config": buildMetaConfigAgent,
  "client-onboarder": buildClientOnboarderAgent,
  drafter: buildDrafterAgent,
  reviewer: buildReviewerAgent,
  scheduler: buildSchedulerAgent,
  "human-gate": buildHumanGateAgent,
  ideator: buildIdeatorAgent,
  pipeline: buildPipelineAgent,
  "cadence-planner": buildCadencePlannerAgent,
  "approval-triage": buildApprovalTriageAgent,
  "awareness-researcher": buildAwarenessResearcherAgent,
  "repurposer": buildRepurposerAgent,
  "gap-filler": buildGapFillerAgent,
  "brand-auditor": buildBrandAuditorAgent,
}

export interface ResolvedAgent {
  name: string
  config: AgentConfig
  agent: BaseAgent
}

async function fetchConfig(
  orgId: string,
  name: string,
): Promise<AgentConfig | null> {
  const snap = await getAdminDb()
    .collection(orgAgentConfigsPath(orgId))
    .doc(name)
    .get()
  if (!snap.exists) return null
  const parsed = agentConfigSchema.safeParse({
    ...(snap.data() ?? {}),
    id: name,
    organizationId: orgId,
  })
  return parsed.success ? parsed.data : null
}

export interface ResolveOverride {
  provider?: AgentProvider
  model?: string
}

export async function resolveAgent(
  orgId: string,
  name: string,
  override?: ResolveOverride,
): Promise<ResolvedAgent | undefined> {
  const factory = FACTORIES[name]
  if (!factory) return undefined
  const fetched = await fetchConfig(orgId, name)
  if (!fetched) return undefined

  /* Per-conversation override (only applies to the top-level agent the user
   * picked - sub-agents in a pipeline keep their own configured models). */
  const config: AgentConfig =
    override?.provider || override?.model
      ? {
          ...fetched,
          provider: override.provider ?? fetched.provider,
          model: override.model ?? fetched.model,
        }
      : fetched

  const helpers: FactoryHelpers = {
    resolveByName: async (childName) => {
      const sub = await resolveAgent(orgId, childName)
      return sub?.agent ?? null
    },
  }

  const agent =
    factory.length >= 2
      ? await (factory as AsyncFactory)(config, helpers)
      : ((factory as SyncFactory)(config) as BaseAgent)

  return { name, config, agent }
}

export function listRegisteredAgents(): string[] {
  return Object.keys(FACTORIES)
}

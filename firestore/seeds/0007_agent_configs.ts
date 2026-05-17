import { db, ensureEmulator, SAFE_ORG_ID, withAudit } from "./_helpers"
import {
  AGENT_DEFAULTS,
  getAgentDefaultBudgets,
} from "@/lib/agents/defaults"

/*
 * Seeds default agent configurations. Idempotent — re-running merges over
 * existing docs without clobbering user edits made through /settings/agents.
 *
 * Source of truth for the template list is `lib/agents/defaults.ts`, shared
 * with the production `installDefaultAgents` server action so the emulator
 * and prod start from the same baseline.
 */

export async function seed0007AgentConfigs() {
  ensureEmulator()
  const col = db()
    .collection("organizations")
    .doc(SAFE_ORG_ID)
    .collection("agentConfigs")

  // Skip awareness-researcher here — 0008 owns it (preserves prior log order).
  const seeds = AGENT_DEFAULTS.filter((d) => d.name !== "awareness-researcher")

  for (const cfg of seeds) {
    const ref = col.doc(cfg.name)
    await ref.set(
      withAudit({
        id: cfg.name,
        organizationId: SAFE_ORG_ID,
        name: cfg.name,
        role: cfg.role,
        description: cfg.description,
        provider: cfg.provider,
        model: cfg.model,
        temperature: cfg.temperature,
        systemPrompt: cfg.systemPrompt,
        enabled: cfg.enabled,
        schedule: cfg.schedule ?? null,
        allowedTools: cfg.allowedTools,
        triggers: cfg.triggers,
        budgets: getAgentDefaultBudgets(cfg),
      }),
      { merge: true },
    )
    console.log(`✓ agentConfig: ${cfg.name}`)
  }
}

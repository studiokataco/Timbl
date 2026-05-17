import { db, ensureEmulator, SAFE_ORG_ID, withAudit } from "./_helpers"
import { getAgentDefault, getAgentDefaultBudgets } from "@/lib/agents/defaults"

/*
 * Seeds the awareness-researcher agent. Idempotent — `set({ merge: true })`
 * preserves user edits made through /settings/agents. Definition lives in
 * `lib/agents/defaults.ts`, shared with the prod installer.
 */
export async function seed0008AwarenessResearcher() {
  ensureEmulator()
  const cfg = getAgentDefault("awareness-researcher")
  if (!cfg) throw new Error("awareness-researcher default not found")

  const ref = db()
    .collection("organizations")
    .doc(SAFE_ORG_ID)
    .collection("agentConfigs")
    .doc(cfg.name)

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

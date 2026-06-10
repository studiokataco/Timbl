import {
  db,
  ensureEmulator,
  TENANT_ADMIN_USER_ID,
  TENANT_ORG_ID,
  withAudit,
} from "./_helpers"
import {
  AGENT_DEFAULTS,
  getAgentDefaultBudgets,
} from "@/lib/agents/defaults"
import { WIZARD_AGENT_IDS } from "@/lib/onboarding/agent-catalog"
import { seedDefaultCtasIfEmpty } from "@/lib/org/seed-default-ctas"

/*
 * Seeds the second dev org - a clean tenant for exercising the onboarding
 * wizard end-to-end. Unlike the Timbl demo org (0001-0009), this org gets:
 *
 *   - NO categories, templates, awareness days, or campaigns. The wizard
 *     is the only thing that should populate those, so its output is
 *     visible against an empty slate instead of buried under demo seeds.
 *   - NO `onboarding.completedAt` - so the (app) layout redirects to
 *     /onboarding on first visit, exactly like a real new signup.
 *   - The FULL real-agent catalog from lib/agents/defaults.ts. The five
 *     wizard-selectable agents start `enabled: false` (the wizard turns
 *     on the user's picks); config + pipeline-machinery agents stay
 *     `enabled: true` so the agent runtime works out of the box.
 *
 * Idempotent: every write is keyed by a deterministic id and skipped if
 * the doc already exists, so a `pnpm dev` re-seed never clobbers wizard
 * edits (category picks, agent toggles, tailored prompts).
 */

const DEFAULT_KANBAN_COLUMNS = [
  { id: "idea", label: "Idea", color: "#94a3b8" },
  { id: "brief", label: "Brief", color: "#fbbf24" },
  { id: "researching", label: "Researching", color: "#fb923c" },
  { id: "designing", label: "Designing", color: "#ec4899" },
  { id: "review", label: "Review", color: "#8b5cf6" },
  { id: "scheduled", label: "Scheduled", color: "#3b82f6" },
  { id: "posted", label: "Posted", color: "#10b981" },
  { id: "missed", label: "Missed", color: "#ef4444" },
  { id: "archived", label: "Archived", color: "#64748b" },
]

export async function seed0010TenantOrg() {
  ensureEmulator()
  const orgRef = db().doc(`organizations/${TENANT_ORG_ID}`)

  /* 1. Org doc - FIRST WRITE ONLY. No completedAt → first visit lands on
   * the wizard. The name is a placeholder the wizard's step-one field
   * overwrites. Unlike the other writes here, this is NOT merged on
   * re-seed: once the wizard has set `name` + `onboarding.completedAt`,
   * a `pnpm dev` re-seed must not stomp them back to the placeholder. */
  if ((await orgRef.get()).exists) {
    console.log("✓ organization: Your workspace (tenant) - exists, skipping")
  } else {
    await orgRef.set(
      withAudit({
        id: TENANT_ORG_ID,
        slug: TENANT_ORG_ID,
        name: "Your workspace",
        primaryColor: "#111111",
        plan: "agency_v1",
        onboarding: {},
      }),
    )
    console.log("✓ organization: Your workspace (tenant)")
  }

  /* 2. Admin user. */
  await orgRef
    .collection("users")
    .doc(TENANT_ADMIN_USER_ID)
    .set(
      withAudit({
        id: TENANT_ADMIN_USER_ID,
        organizationId: TENANT_ORG_ID,
        email: "owner@yourworkspace.dev",
        name: "Workspace owner",
        role: "admin",
        defaultCategories: [],
      }),
      { merge: true },
    )
  console.log("✓ user: Workspace owner (role=admin)")

  /* 3. Kanban columns - only if none exist yet (board needs a shape). */
  const colsCol = orgRef.collection("kanbanColumns")
  if ((await colsCol.limit(1).get()).empty) {
    for (let i = 0; i < DEFAULT_KANBAN_COLUMNS.length; i++) {
      const c = DEFAULT_KANBAN_COLUMNS[i]
      await colsCol.doc(c.id).set(
        withAudit({
          id: c.id,
          organizationId: TENANT_ORG_ID,
          label: c.label,
          color: c.color,
          sortOrder: i,
          isSystemDefault: true,
        }),
      )
    }
    console.log(`✓ kanban columns: ${DEFAULT_KANBAN_COLUMNS.length}`)
  } else {
    console.log("✓ kanban columns: already seeded, skipping")
  }

  const installedCtas = await seedDefaultCtasIfEmpty(db(), TENANT_ORG_ID)
  if (installedCtas.length > 0) {
    console.log(`✓ ctas: ${installedCtas.length}`)
  } else {
    console.log("✓ ctas: already seeded, skipping")
  }

  /* 4. Agent catalog. Per-doc existence check so a re-seed never resets
   * the wizard's `enabled` toggles or tailored systemPrompt. */
  const agentCol = orgRef.collection("agentConfigs")
  let installed = 0
  for (const cfg of AGENT_DEFAULTS) {
    const ref = agentCol.doc(cfg.name)
    if ((await ref.get()).exists) continue
    /* Wizard-selectable agents start off; the wizard enables the user's
     * picks. Everything else (config + pipeline machinery) starts on. */
    const enabled = WIZARD_AGENT_IDS.includes(cfg.name) ? false : cfg.enabled
    await ref.set(
      withAudit({
        id: cfg.name,
        organizationId: TENANT_ORG_ID,
        name: cfg.name,
        role: cfg.role,
        description: cfg.description,
        provider: cfg.provider,
        model: cfg.model,
        temperature: cfg.temperature,
        systemPrompt: cfg.systemPrompt,
        enabled,
        schedule: cfg.schedule ?? null,
        allowedTools: cfg.allowedTools,
        triggers: cfg.triggers,
        budgets: getAgentDefaultBudgets(cfg),
      }),
    )
    installed += 1
  }
  console.log(
    `✓ agentConfigs: ${installed} installed, ${AGENT_DEFAULTS.length - installed} already present`,
  )
}

if (require.main === module) {
  seed0010TenantOrg().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

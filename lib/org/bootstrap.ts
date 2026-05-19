import "server-only"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgPath } from "@/lib/firebase/paths"
import {
  AGENT_DEFAULTS,
  getAgentDefaultBudgets,
  type AgentDefault,
} from "@/lib/agents/defaults"

/*
 * One-shot bootstrap for a freshly-created org. Called by:
 *
 *   - functions/src/setUserClaims.ts (blocking trigger) when a new domain
 *     signs in and no /organizations/{orgId} doc exists yet
 *   - manual provisioning utilities (admin scripts, future "Create org"
 *     button)
 *
 * What it writes:
 *   - /organizations/{orgId}                — root doc with name, slug, plan
 *   - /organizations/{orgId}/agentConfigs/* — full AGENT_DEFAULTS catalog
 *                                              so the wizard's "Agents" step
 *                                              has rows to toggle
 *   - /organizations/{orgId}/kanbanColumns/* — 9 default columns matching
 *                                               LEGACY_POST_STATUSES
 *
 * Intentionally does NOT write:
 *   - categories — handed off to the onboarding wizard's industry-defaults
 *     so the user picks what they want
 *   - users — handed off to the caller (the blocking function writes the
 *     admin user doc with its own role/email/uid info)
 *   - brandConfig — left empty until the wizard or brand wizard agent
 *     fills it in
 *   - templates — handed off to wizard step 4
 *
 * Idempotent: every write uses merge: true and checks for existing rows
 * before overwriting catalog entries. Safe to call twice.
 */

const DEFAULT_PLAN_FOR_NEW_ORG = "agency_v1"
/* Why agency_v1 and not free_v1?
 *
 * Per the productization plan + user direction: we want a "free hand" until
 * launch — no plan-gates firing during pilot or dev. agency_v1 has a 5000
 * agentRuns/mo cap and unlimited scheduled posts, which covers any pilot
 * workload. When Stripe ships (Phase H) and self-serve signup goes live,
 * this constant flips to free_v1 and existing orgs grandfather. */

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

export interface BootstrapNewOrgInput {
  orgId: string
  /* Human-readable name shown in the top bar and login messages. Slug is
   * derived from this if not provided. */
  name: string
  slug?: string
}

export interface BootstrapNewOrgResult {
  orgId: string
  /* Names of newly-written agentConfig rows. Empty when the org already
   * had the full catalog. */
  installedAgents: string[]
  skippedAgents: string[]
  installedColumns: string[]
}

export async function bootstrapNewOrg(
  input: BootstrapNewOrgInput,
): Promise<BootstrapNewOrgResult> {
  const db = getAdminDb()
  const orgRef = db.doc(orgPath(input.orgId))
  const now = new Date().toISOString()
  const slug = input.slug ?? slugify(input.name) ?? input.orgId

  /* 1. Org root doc. */
  await orgRef.set(
    {
      id: input.orgId,
      name: input.name,
      slug,
      plan: DEFAULT_PLAN_FOR_NEW_ORG,
      /* No completedAt — the (app) layout will redirect to /onboarding
       * on first sign-in so the new admin walks the wizard. */
      onboarding: {},
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  )

  /* 2. Agent catalog — write every AGENT_DEFAULTS entry the org doesn't
   * already have. Mirrors the logic in lib/actions/agent-configs.ts
   * `installDefaultAgents` so the bootstrap path and the manual-install
   * path produce identical shapes. */
  const agentCol = orgRef.collection("agentConfigs")
  const installedAgents: string[] = []
  const skippedAgents: string[] = []
  for (const def of AGENT_DEFAULTS) {
    const ref = agentCol.doc(def.name)
    const existing = await ref.get()
    if (existing.exists) {
      skippedAgents.push(def.name)
      continue
    }
    await ref.set(agentConfigDocFromDefault(def, input.orgId, now))
    installedAgents.push(def.name)
  }

  /* 3. Kanban columns. Only seed when the collection is empty — once the
   * user starts customising we never overwrite. */
  const colsCol = orgRef.collection("kanbanColumns")
  const installedColumns: string[] = []
  const existingCols = await colsCol.limit(1).get()
  if (existingCols.empty) {
    for (let i = 0; i < DEFAULT_KANBAN_COLUMNS.length; i++) {
      const c = DEFAULT_KANBAN_COLUMNS[i]
      await colsCol.doc(c.id).set({
        id: c.id,
        organizationId: input.orgId,
        label: c.label,
        color: c.color,
        sortOrder: i,
        isSystemDefault: true,
        createdAt: now,
        updatedAt: now,
      })
      installedColumns.push(c.id)
    }
  }

  return { orgId: input.orgId, installedAgents, skippedAgents, installedColumns }
}

function agentConfigDocFromDefault(
  d: AgentDefault,
  orgId: string,
  now: string,
) {
  return {
    id: d.name,
    organizationId: orgId,
    name: d.name,
    role: d.role,
    description: d.description,
    provider: d.provider,
    model: d.model,
    temperature: d.temperature,
    systemPrompt: d.systemPrompt,
    enabled: d.enabled,
    schedule: d.schedule ?? null,
    allowedTools: d.allowedTools,
    triggers: d.triggers,
    budgets: getAgentDefaultBudgets(d),
    createdAt: now,
    updatedAt: now,
  }
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60)
}

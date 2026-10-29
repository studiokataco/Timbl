import "server-only"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgPath, orgBrandDocPath } from "@/lib/firebase/paths"
import { DEFAULT_BRAND_ID } from "@/lib/constants/timbl"
import {
  AGENT_DEFAULTS,
  getAgentDefaultBudgets,
  type AgentDefault,
} from "@/lib/agents/defaults"
import { seedDefaultCtasIfEmpty } from "@/lib/org/seed-default-ctas"

/*
 * One-shot bootstrap for a freshly-created org. Called by:
 *
 *   - functions/src/setUserClaims.ts (blocking trigger) when a new domain
 *     signs in and no /organizations/{orgId} doc exists yet
 *   - manual provisioning utilities (admin scripts, future "Create org"
 *     button)
 *
 * What it writes:
 *   - /organizations/{orgId}                - root doc with name, slug, plan
 *   - /organizations/{orgId}/agentConfigs/* - full AGENT_DEFAULTS catalog
 *                                              so the wizard's "Agents" step
 *                                              has rows to toggle
 *   - /organizations/{orgId}/kanbanColumns/* - 9 default columns matching
 *                                               LEGACY_POST_STATUSES
 *   - /organizations/{orgId}/ctas/*         - default CTA picklist for
 *                                               composer / quick add
 *
 * Intentionally does NOT write:
 *   - categories - handed off to the onboarding wizard's industry-defaults
 *     so the user picks what they want
 *   - users - handed off to the caller (the blocking function writes the
 *     admin user doc with its own role/email/uid info)
 *   - brandConfig - left empty until the wizard or brand wizard agent
 *     fills it in
 *   - templates - handed off to wizard step 4
 *
 * Idempotent: every write uses merge: true and checks for existing rows
 * before overwriting catalog entries. Safe to call twice.
 */

const DEFAULT_PLAN_FOR_NEW_ORG = "free_v1"
/* Razorpay billing (Phase H) is live and self-serve signup is open, so a new
 * org starts on Free and upgrades via Settings -> Billing. Existing orgs were
 * backfilled to an explicit plan before this flipped (they grandfather). */

const DEFAULT_KANBAN_COLUMNS = [
  { id: "idea", label: "Idea", color: "#94a3b8" },
  { id: "brief", label: "Brief", color: "#fbbf24" },
  { id: "researching", label: "Researching", color: "#fb923c" },
  { id: "designing", label: "Designing", color: "#ec4899" },
  { id: "review", label: "Review", color: "#8b5cf6" },
  { id: "scheduled", label: "Scheduled", color: "#3b82f6", group: "done" },
  { id: "posted", label: "Posted", color: "#10b981", group: "done" },
  { id: "missed", label: "Missed", color: "#ef4444", group: "closed" },
  { id: "archived", label: "Archived", color: "#64748b", group: "closed" },
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
  installedCtas: string[]
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
      /* No completedAt - the (app) layout will redirect to /onboarding
       * on first sign-in so the new admin walks the wizard. */
      onboarding: {},
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  )

  /* 2. Agent catalog - write every AGENT_DEFAULTS entry the org doesn't
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

  /* 3. Kanban columns. Only seed when the collection is empty - once the
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
        group: c.group ?? "active",
        sortOrder: i,
        isSystemDefault: true,
        createdAt: now,
        updatedAt: now,
      })
      installedColumns.push(c.id)
    }
  }

  const installedCtas = await seedDefaultCtasIfEmpty(db, input.orgId)

  /* Default brand shell. Voice/audience/cadence stay empty until the wizard
   * fills them (brandConfigSchema tolerates the placeholders); the point here
   * is that every org has a brand doc at /brands/default from creation, so no
   * surface has to reason about a brand-less org. */
  const brandRef = db.doc(orgBrandDocPath(input.orgId, DEFAULT_BRAND_ID))
  if (!(await brandRef.get()).exists) {
    await brandRef.set({
      id: DEFAULT_BRAND_ID,
      organizationId: input.orgId,
      name: input.name,
      voice: "",
      audience: "",
      channels: [],
      targetCadence: { perWeek: 3, preferredDays: [], preferredTimes: [] },
      forbiddenTopics: [],
      samplePosts: [],
      createdAt: now,
      updatedAt: now,
    })
  }

  return { orgId: input.orgId, installedAgents, skippedAgents, installedColumns, installedCtas }
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

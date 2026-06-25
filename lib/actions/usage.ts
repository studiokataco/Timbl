"use server"

import { getCurrentOrgId, getDb } from "@/lib/auth/server-helpers"
import { isBoutiqueAgent } from "@/lib/agents/defaults"
import { modelLabel, MODEL_SUGGESTIONS } from "@/lib/agents/provider-catalog"
import { getAdminDb } from "@/lib/firebase/admin"
import { orgAgentConfigsPath, orgSocialAccountsPath, orgUsersPath } from "@/lib/firebase/paths"
import { getOrgPlan } from "@/lib/plans/gate"
import { safeFieldKey } from "@/lib/platform/schema"
import { readUsageSnapshot } from "@/lib/telemetry/agent-events"

/*
 * Tenant-facing usage overview for Settings -> Usage. Read-only: counters are
 * written by lib/telemetry/agent-events.ts (agent runs, scheduled posts) and
 * gated by lib/plans/gate.ts; this action only projects them next to the
 * org's plan limits (quotaOverrides already merged by getOrgPlan).
 */

/* Mirrors CHANNELS_PER_BRAND in lib/actions/social-accounts.ts - the brands
 * quota is enforced there as brands * channels-per-brand connectable accounts. */
const CHANNELS_PER_BRAND = 4

export type UsageMetricKey = "agentRuns" | "scheduledPosts" | "channels" | "seats" | "agents"

export type OrgUsageMetric = {
  key: UsageMetricKey
  label: string
  hint: string
  used: number
  /* null = no limit on this plan. */
  limit: number | null
  /* Resets monthly (agent runs, posts) vs standing capacity (channels, seats). */
  resets: boolean
}

export type OrgUsage = {
  /* YYYY-MM, UTC - same period key the quota counters use. */
  period: string
  planId: string
  planLabel: string
  tier: string
  metrics: OrgUsageMetric[]
}

export async function getUsageOverview(): Promise<OrgUsage> {
  const orgId = await getCurrentOrgId()
  const plan = await getOrgPlan(orgId)
  const snapshot = await readUsageSnapshot(orgId)

  const db = getDb()
  const [channelsSnap, usersSnap, agentConfigsSnap] = await Promise.all([
    db
      .collection(orgSocialAccountsPath(orgId))
      .where("status", "in", ["active", "needs_reauth"])
      .get(),
    db.collection(orgUsersPath(orgId)).get(),
    getAdminDb().collection(orgAgentConfigsPath(orgId)).get(),
  ])
  const channelsUsed = channelsSnap.size
  const seatsUsed = usersSnap.docs.filter((d) => d.data().active !== false).length
  const boutiqueActive = agentConfigsSnap.docs.filter(
    (d) => isBoutiqueAgent(d.id) && d.data().enabled !== false,
  ).length

  return {
    period: snapshot.period,
    planId: plan.id,
    planLabel: plan.label,
    tier: plan.tier,
    metrics: [
      {
        key: "agentRuns",
        label: "Agent runs",
        hint: "AI agent runs this month, successes and failures both count",
        used: snapshot.agentRuns,
        limit: plan.quotas.agentRuns,
        resets: true,
      },
      {
        key: "scheduledPosts",
        label: "Scheduled posts",
        hint: "Posts moved to scheduled this month",
        used: snapshot.scheduledPosts,
        limit: plan.quotas.scheduledPosts,
        resets: true,
      },
      {
        key: "channels",
        label: "Connected channels",
        hint: "Social accounts connected for publishing",
        used: channelsUsed,
        limit: plan.quotas.brands === null ? null : plan.quotas.brands * CHANNELS_PER_BRAND,
        resets: false,
      },
      {
        key: "seats",
        label: "Seats",
        hint: "Active members in this workspace",
        used: seatsUsed,
        limit: plan.quotas.seats,
        resets: false,
      },
      {
        key: "agents",
        label: "AI agents",
        hint: "Agents switched on in Studio",
        used: boutiqueActive,
        limit: plan.quotas.agents,
        resets: false,
      },
    ],
  }
}

/*
 * Tenant-facing agent usage dashboard for Studio. Reads the current-period
 * org usage rollup (written by lib/telemetry/agent-events.ts) and projects it
 * into KPI totals + per-agent and per-model breakdowns - the "where do my
 * tokens, calls, and spend go" view, scoped to the caller's org.
 *
 * Per-agent token + cost (tokensByAgent / usdByAgent) populate going forward
 * from the telemetry write; older runs only carry agentRunsByAgent (calls).
 */
export type StudioAgentUsage = {
  agent: string
  calls: number
  tokens: number
  usd: number
}

export type StudioUsage = {
  period: string
  usdCost: number
  agentRuns: number
  promptTokens: number
  completionTokens: number
  cachedTokens: number
  byAgent: StudioAgentUsage[]
  byModel: Record<string, number>
  byProvider: Record<string, number>
  /* Maps the safeFieldKey-encoded model keys back to human labels. */
  modelNames: Record<string, string>
}

export async function getStudioUsage(): Promise<StudioUsage> {
  const orgId = await getCurrentOrgId()
  const snapshot = await readUsageSnapshot(orgId)

  const agents = new Set<string>([
    ...Object.keys(snapshot.agentRunsByAgent),
    ...Object.keys(snapshot.tokensByAgent),
    ...Object.keys(snapshot.usdByAgent),
  ])
  const byAgent: StudioAgentUsage[] = Array.from(agents)
    .map((agent) => ({
      agent,
      calls: snapshot.agentRunsByAgent[agent] ?? 0,
      tokens: snapshot.tokensByAgent[agent] ?? 0,
      usd: snapshot.usdByAgent[agent] ?? 0,
    }))
    .sort((a, b) => b.tokens - a.tokens || b.calls - a.calls)

  return {
    period: snapshot.period,
    usdCost: snapshot.usdCost,
    agentRuns: snapshot.agentRuns,
    promptTokens: snapshot.promptTokens,
    completionTokens: snapshot.completionTokens,
    cachedTokens: snapshot.cachedTokens,
    byAgent,
    byModel: snapshot.usdByModel,
    byProvider: snapshot.usdByProvider,
    modelNames: buildModelNames(),
  }
}

/* The rollup stores cost under safeFieldKey-encoded model ids ("a/b" -> "a_b").
 * Pre-compute the encoded -> label map for every model in the ladder so the
 * dashboard can show readable names instead of mangled keys. */
function buildModelNames(): Record<string, string> {
  const names: Record<string, string> = {}
  for (const ids of Object.values(MODEL_SUGGESTIONS)) {
    for (const id of ids) {
      names[safeFieldKey(id)] = modelLabel(id)
    }
  }
  return names
}

"use server"

import { getCurrentOrgId, getDb } from "@/lib/auth/server-helpers"
import { orgSocialAccountsPath, orgUsersPath } from "@/lib/firebase/paths"
import { getOrgPlan } from "@/lib/plans/gate"
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

export type UsageMetricKey = "agentRuns" | "scheduledPosts" | "channels" | "seats"

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
  const [channelsSnap, usersSnap] = await Promise.all([
    db
      .collection(orgSocialAccountsPath(orgId))
      .where("status", "in", ["active", "needs_reauth"])
      .get(),
    db.collection(orgUsersPath(orgId)).get(),
  ])
  const channelsUsed = channelsSnap.size
  const seatsUsed = usersSnap.docs.filter((d) => d.data().active !== false).length

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
    ],
  }
}

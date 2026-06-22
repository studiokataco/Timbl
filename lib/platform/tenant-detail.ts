import "server-only"

import { getAdminDb } from "@/lib/firebase/admin"
import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import {
  orgAccessRequestsPath,
  orgAgentConfigsPath,
  orgCategoriesPath,
  orgInvitesPath,
  orgPath,
  orgPostsPath,
  orgSocialAccountsPath,
  orgTemplatesPath,
  orgUsageDocPath,
  orgUsersPath,
} from "@/lib/firebase/paths"
import { getPlan, type QuotaMetric } from "@/lib/plans/plans"
import {
  impersonationSessionSchema,
  platformAuditEntrySchema,
  platformAuditLogPath,
  platformImpersonationPath,
  platformOrgRollupDailyPath,
  platformOrgRollupPeriodsPath,
  type PlatformAuditEntry,
} from "@/lib/platform/schema"
import { currentPeriod, type TrendPoint } from "./queries"

/*
 * Per-tenant detail read models for the control-centre tenant page. Each
 * re-asserts platform admin (defense in depth behind the layout guard) and
 * routes through the org path helpers so the multi-tenant scoping is explicit.
 */

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0
}

export interface OrgProfile {
  createdAt: string | null
  plan: string
  status: "active" | "suspended"
  suspendedAt: string | null
  trialStartedAt: string | null
  trialEndsAt: string | null
  trialDaysLeft: number | null
  billingStatus: string | null
  grandfathered: boolean
  grandfatheredAt: string | null
  onboardingCompletedAt: string | null
  profile: {
    industry: string | null
    audience: string | null
    tone: string | null
    channels: string[]
  }
  featureFlags: Record<string, boolean>
  quotaOverrides: Partial<Record<QuotaMetric, number | null>>
}

export async function getOrgProfile(orgId: string): Promise<OrgProfile | null> {
  await requirePlatformAdmin()
  const snap = await getAdminDb().doc(orgPath(orgId)).get()
  if (!snap.exists) return null
  const d = snap.data() ?? {}
  const onboarding = (d.onboarding ?? {}) as {
    completedAt?: string
    profile?: { industry?: string; audience?: string; tone?: string; channels?: string[] }
  }
  const trialEndsAt = (d.trialEndsAt as string | null) ?? null
  const billingStatus = (d.billingStatus as string | null) ?? null
  const trialDaysLeft =
    billingStatus === "trialing" && trialEndsAt
      ? Math.max(0, Math.ceil((Date.parse(trialEndsAt) - Date.now()) / 86_400_000))
      : null
  return {
    createdAt: (d.createdAt as string | null) ?? null,
    plan: (d.plan as string) ?? "free_v1",
    status: (d.status as "active" | "suspended") ?? "active",
    suspendedAt: (d.suspendedAt as string | null) ?? null,
    trialStartedAt: (d.trialStartedAt as string | null) ?? null,
    trialEndsAt,
    trialDaysLeft,
    billingStatus,
    grandfathered: d.grandfathered === true,
    grandfatheredAt: (d.grandfatheredAt as string | null) ?? null,
    onboardingCompletedAt: onboarding.completedAt ?? null,
    profile: {
      industry: onboarding.profile?.industry ?? null,
      audience: onboarding.profile?.audience ?? null,
      tone: onboarding.profile?.tone ?? null,
      channels: onboarding.profile?.channels ?? [],
    },
    featureFlags: (d.featureFlags as Record<string, boolean>) ?? {},
    quotaOverrides:
      (d.quotaOverrides as Partial<Record<QuotaMetric, number | null>>) ?? {},
  }
}

export interface OrgMember {
  id: string
  name: string
  email: string
  role: string
  active: boolean
}

export interface OrgTeam {
  members: OrgMember[]
  pendingInvites: number
  accessRequests: number
}

export async function getOrgTeam(orgId: string): Promise<OrgTeam> {
  await requirePlatformAdmin()
  const db = getAdminDb()
  const [usersSnap, invites, requests] = await Promise.all([
    db.collection(orgUsersPath(orgId)).get(),
    db.collection(orgInvitesPath(orgId)).count().get(),
    db.collection(orgAccessRequestsPath(orgId)).count().get(),
  ])
  const members: OrgMember[] = usersSnap.docs.map((doc) => {
    const d = doc.data()
    return {
      id: doc.id,
      name: (d.name as string) ?? "Unknown",
      email: (d.email as string) ?? "",
      role: (d.role as string) ?? "contributor",
      active: d.active !== false,
    }
  })
  members.sort((a, b) => a.name.localeCompare(b.name))
  return {
    members,
    pendingInvites: invites.data().count,
    accessRequests: requests.data().count,
  }
}

export interface ConnectedAccount {
  channel: string
  displayName: string
  status: string
}

export interface OrgInventory {
  posts: number
  categories: number
  templates: number
  agents: number
  accounts: ConnectedAccount[]
}

export async function getOrgInventory(orgId: string): Promise<OrgInventory> {
  await requirePlatformAdmin()
  const db = getAdminDb()
  const [posts, categories, templates, agents, accountsSnap] = await Promise.all([
    db.collection(orgPostsPath(orgId)).count().get(),
    db.collection(orgCategoriesPath(orgId)).count().get(),
    db.collection(orgTemplatesPath(orgId)).count().get(),
    db.collection(orgAgentConfigsPath(orgId)).count().get(),
    db.collection(orgSocialAccountsPath(orgId)).get(),
  ])
  const accounts: ConnectedAccount[] = accountsSnap.docs.map((doc) => {
    const d = doc.data()
    return {
      channel: (d.channel as string) ?? doc.id,
      displayName: (d.displayName as string) ?? "",
      status: (d.status as string) ?? "active",
    }
  })
  return {
    posts: posts.data().count,
    categories: categories.data().count,
    templates: templates.data().count,
    agents: agents.data().count,
    accounts,
  }
}

const USAGE_METRICS: QuotaMetric[] = ["agentRuns", "scheduledPosts", "brands", "seats"]

export interface UsageMetric {
  metric: QuotaMetric
  used: number
  limit: number | null
}

export async function getOrgUsage(
  orgId: string,
  plan: string,
  quotaOverrides: Partial<Record<QuotaMetric, number | null>>,
  period = currentPeriod(),
): Promise<UsageMetric[]> {
  await requirePlatformAdmin()
  const snap = await getAdminDb().doc(orgUsageDocPath(orgId, period)).get()
  const d = snap.data() ?? {}
  const quotas = getPlan(plan).quotas
  return USAGE_METRICS.map((metric) => {
    const limit =
      metric in quotaOverrides && quotaOverrides[metric] !== undefined
        ? (quotaOverrides[metric] as number | null)
        : quotas[metric]
    return { metric, used: num(d[metric]), limit }
  })
}

/* Per-org daily spend for the last N days, gap-filled. Mirrors
 * globalDailyTrend but scoped to one org's daily rollup subcollection. */
export async function orgDailyTrend(orgId: string, days = 14): Promise<TrendPoint[]> {
  await requirePlatformAdmin()
  const cutoff = new Date(Date.now() - (days - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10)
  const snap = await getAdminDb()
    .collection(platformOrgRollupDailyPath(orgId))
    .where("date", ">=", cutoff)
    .get()
  const byDate = new Map<string, { usd: number; runs: number }>()
  for (const doc of snap.docs) {
    const d = doc.data()
    const date = (d.date as string) ?? doc.id
    const acc = byDate.get(date) ?? { usd: 0, runs: 0 }
    acc.usd += num(d.usdCost)
    acc.runs += num(d.agentRuns)
    byDate.set(date, acc)
  }
  const out: TrendPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10)
    const v = byDate.get(date) ?? { usd: 0, runs: 0 }
    out.push({ date, usd: Math.round(v.usd * 100) / 100, runs: v.runs })
  }
  return out
}

export interface PeriodRow {
  period: string
  usdCost: number
  agentRuns: number
  succeeded: number
  failed: number
}

export async function getOrgPeriods(orgId: string, n = 6): Promise<PeriodRow[]> {
  await requirePlatformAdmin()
  const snap = await getAdminDb()
    .collection(platformOrgRollupPeriodsPath(orgId))
    .get()
  const rows: PeriodRow[] = snap.docs.map((doc) => {
    const d = doc.data()
    const outcome = (d.runsByOutcome ?? {}) as Record<string, number>
    return {
      period: (d.period as string) ?? doc.id,
      usdCost: num(d.usdCost),
      agentRuns: num(d.agentRuns),
      succeeded: num(outcome.succeeded),
      failed: num(outcome.failed),
    }
  })
  rows.sort((a, b) => b.period.localeCompare(a.period))
  return rows.slice(0, n)
}

/* Org-scoped slice of the platform audit log. Equality-only filter so no
 * composite index is needed - sort newest-first in-process. */
export async function getOrgAuditFeed(
  orgId: string,
  limit = 50,
): Promise<PlatformAuditEntry[]> {
  await requirePlatformAdmin()
  const snap = await getAdminDb()
    .collection(platformAuditLogPath)
    .where("targetOrgId", "==", orgId)
    .limit(limit)
    .get()
  const out: PlatformAuditEntry[] = []
  for (const doc of snap.docs) {
    const parsed = platformAuditEntrySchema.safeParse({ ...doc.data(), id: doc.id })
    if (parsed.success) out.push(parsed.data)
  }
  out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return out
}

export interface OrgImpersonation {
  id: string
  adminEmail: string
  createdAt: string
  state: "active" | "ended" | "revoked"
}

export async function getOrgImpersonations(
  orgId: string,
  limit = 20,
): Promise<OrgImpersonation[]> {
  await requirePlatformAdmin()
  const now = Date.now()
  const snap = await getAdminDb()
    .collection(platformImpersonationPath)
    .where("orgId", "==", orgId)
    .limit(limit)
    .get()
  const out: OrgImpersonation[] = []
  for (const doc of snap.docs) {
    const parsed = impersonationSessionSchema.safeParse({ ...doc.data(), id: doc.id })
    if (!parsed.success) continue
    const s = parsed.data
    out.push({
      id: s.id,
      adminEmail: s.adminEmail,
      createdAt: s.createdAt,
      state: s.revoked ? "revoked" : Date.parse(s.expiresAt) < now ? "ended" : "active",
    })
  }
  out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return out
}

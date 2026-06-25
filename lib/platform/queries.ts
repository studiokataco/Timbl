import "server-only"

import { getAdminDb } from "@/lib/firebase/admin"
import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import { orgAgentRunsPath, orgPath, orgUsersPath } from "@/lib/firebase/paths"
import {
  platformOrgRollupDocPath,
  platformOrgRollupPeriodDocPath,
  platformOrgRollupsPath,
  platformRealtimeHealthPath,
  platformRollupDocPath,
  platformSignupRequestsPath,
  signupRequestSchema,
  type SignupRequest,
} from "@/lib/platform/schema"

/*
 * Control-centre read models. Analytics read the pre-aggregated platform
 * rollups (O(1)); only live-ops touches raw runs via collectionGroup,
 * bounded by time + limit. Every function re-asserts platform admin -
 * defense in depth behind the (control) layout guard, because these can be
 * imported by any server component.
 */

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0
}

export function currentPeriod(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

export interface GlobalRollup {
  period: string
  usdCost: number
  agentRuns: number
  promptTokens: number
  completionTokens: number
  cachedTokens: number
  embeddingCalls: number
  succeeded: number
  failed: number
  activeOrgs: number
  byProvider: Record<string, number>
  byModel: Record<string, number>
  modelNames: Record<string, string>
}

export async function getGlobalRollup(
  period = currentPeriod(),
): Promise<GlobalRollup> {
  await requirePlatformAdmin()
  const snap = await getAdminDb().doc(platformRollupDocPath(period)).get()
  const d = snap.data() ?? {}
  const outcome = (d.runsByOutcome ?? {}) as Record<string, number>
  return {
    period,
    usdCost: num(d.usdCost),
    agentRuns: num(d.agentRuns),
    promptTokens: num(d.promptTokens),
    completionTokens: num(d.completionTokens),
    cachedTokens: num(d.cachedTokens),
    embeddingCalls: num(d.embeddingCalls),
    succeeded: num(outcome.succeeded),
    failed: num(outcome.failed),
    activeOrgs: num(d.activeOrgs),
    byProvider: (d.byProvider as Record<string, number>) ?? {},
    byModel: (d.byModel as Record<string, number>) ?? {},
    modelNames: (d.modelNames as Record<string, string>) ?? {},
  }
}

export interface TrendPoint {
  date: string
  usd: number
  runs: number
}

/* Daily platform-wide spend for the last N days, aggregated across all orgs'
 * per-day rollups. Powers the spend-trend chart. */
export async function globalDailyTrend(days = 14): Promise<TrendPoint[]> {
  await requirePlatformAdmin()
  const cutoff = new Date(Date.now() - (days - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10)
  const snap = await getAdminDb()
    .collectionGroup("daily")
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
  /* Fill gaps so the line is continuous. */
  const out: TrendPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10)
    const v = byDate.get(date) ?? { usd: 0, runs: 0 }
    out.push({ date, usd: Math.round(v.usd * 100) / 100, runs: v.runs })
  }
  return out
}

export interface OrgRow {
  orgId: string
  name: string
  plan: string
  status: "active" | "suspended"
  suspendedAt: string | null
  seats: number
  mtdUsdCost: number
  mtdAgentRuns: number
  failureRate: number
  onboardingCompletedAt: string | null
  lastRunAt: string | null
  /* Lifecycle fields joined from the authoritative org doc (the rollup
   * snapshot does not carry them). */
  createdAt: string | null
  trialEndsAt: string | null
  billingStatus: string | null
  grandfathered: boolean
}

interface Lifecycle {
  createdAt: string | null
  trialEndsAt: string | null
  billingStatus: string | null
  grandfathered: boolean
}

function lifecycleFromOrgDoc(d: FirebaseFirestore.DocumentData): Lifecycle {
  return {
    createdAt: (d.createdAt as string | null) ?? null,
    trialEndsAt: (d.trialEndsAt as string | null) ?? null,
    billingStatus: (d.billingStatus as string | null) ?? null,
    grandfathered: d.grandfathered === true,
  }
}

function rowFromRollup(orgId: string, d: FirebaseFirestore.DocumentData): OrgRow {
  return {
    orgId: (d.orgId as string) ?? orgId,
    name: (d.name as string) ?? orgId,
    plan: (d.plan as string) ?? "agency_v1",
    status: (d.status as "active" | "suspended") ?? "active",
    suspendedAt: null,
    seats: num(d.seats),
    mtdUsdCost: num(d.mtdUsdCost),
    mtdAgentRuns: num(d.mtdAgentRuns),
    failureRate: num(d.failureRate),
    onboardingCompletedAt: (d.onboardingCompletedAt as string | null) ?? null,
    lastRunAt: (d.lastRunAt as string | null) ?? null,
    createdAt: null,
    trialEndsAt: null,
    billingStatus: null,
    grandfathered: false,
  }
}

/* Rollup docs only exist once telemetry has been ingested (or the hourly
 * reconciler has run). An org with zero runs must still be visible in the
 * control centre, so fall back to the authoritative org doc with zeroed
 * telemetry. */
function rowFromOrgDoc(
  orgId: string,
  d: FirebaseFirestore.DocumentData,
  seats: number,
): OrgRow {
  const onboarding = (d.onboarding ?? {}) as { completedAt?: string }
  return {
    orgId,
    name: (d.name as string) ?? orgId,
    plan: (d.plan as string) ?? "agency_v1",
    status: (d.status as "active" | "suspended") ?? "active",
    suspendedAt: (d.suspendedAt as string | null) ?? null,
    seats,
    mtdUsdCost: 0,
    mtdAgentRuns: 0,
    failureRate: 0,
    onboardingCompletedAt: onboarding.completedAt ?? null,
    lastRunAt: null,
    ...lifecycleFromOrgDoc(d),
  }
}

export async function listOrgRows(): Promise<OrgRow[]> {
  await requirePlatformAdmin()
  const db = getAdminDb()
  const [rollupSnap, orgsSnap] = await Promise.all([
    db.collection(platformOrgRollupsPath).get(),
    db.collection("organizations").get(),
  ])
  const rows = new Map<string, OrgRow>()
  for (const doc of rollupSnap.docs) rows.set(doc.id, rowFromRollup(doc.id, doc.data()))
  /* The org doc is authoritative for lifecycle + status fields the rollup
   * snapshot doesn't carry; join it onto every rollup-derived row. */
  for (const doc of orgsSnap.docs) {
    const row = rows.get(doc.id)
    if (!row) continue
    const d = doc.data()
    row.status = (d.status as "active" | "suspended") ?? row.status
    row.suspendedAt = (d.suspendedAt as string | null) ?? null
    Object.assign(row, lifecycleFromOrgDoc(d))
  }
  const missing = orgsSnap.docs.filter((doc) => !rows.has(doc.id))
  const seatCounts = await Promise.all(
    missing.map((doc) => db.collection(orgUsersPath(doc.id)).count().get()),
  )
  missing.forEach((doc, i) => {
    rows.set(doc.id, rowFromOrgDoc(doc.id, doc.data(), seatCounts[i].data().count))
  })
  const out = [...rows.values()]
  out.sort((a, b) => b.mtdUsdCost - a.mtdUsdCost)
  return out
}

export async function getOrgRow(orgId: string): Promise<OrgRow | null> {
  await requirePlatformAdmin()
  const db = getAdminDb()
  const [rollupSnap, orgSnap] = await Promise.all([
    db.doc(platformOrgRollupDocPath(orgId)).get(),
    db.doc(orgPath(orgId)).get(),
  ])
  if (!rollupSnap.exists && !orgSnap.exists) return null
  let row: OrgRow
  if (rollupSnap.exists) {
    row = rowFromRollup(orgId, rollupSnap.data() ?? {})
  } else {
    const seats = await db.collection(orgUsersPath(orgId)).count().get()
    return rowFromOrgDoc(orgId, orgSnap.data() ?? {}, seats.data().count)
  }
  /* The rollup snapshot is reconciler-lagged; the org doc is authoritative
   * for lifecycle fields, and is the only source of suspendedAt. */
  if (orgSnap.exists) {
    const d = orgSnap.data() ?? {}
    row.name = (d.name as string) ?? row.name
    row.plan = (d.plan as string) ?? row.plan
    row.status = (d.status as "active" | "suspended") ?? "active"
    row.suspendedAt = (d.suspendedAt as string | null) ?? null
    Object.assign(row, lifecycleFromOrgDoc(d))
  }
  return row
}

export interface OrgPeriod {
  period: string
  usdCost: number
  agentRuns: number
  byModel: Record<string, number>
  byProvider: Record<string, number>
  succeeded: number
  failed: number
}

export async function getOrgPeriod(
  orgId: string,
  period = currentPeriod(),
): Promise<OrgPeriod> {
  await requirePlatformAdmin()
  const snap = await getAdminDb()
    .doc(platformOrgRollupPeriodDocPath(orgId, period))
    .get()
  const d = snap.data() ?? {}
  const outcome = (d.runsByOutcome ?? {}) as Record<string, number>
  return {
    period,
    usdCost: num(d.usdCost),
    agentRuns: num(d.agentRuns),
    byModel: (d.byModel as Record<string, number>) ?? {},
    byProvider: (d.byProvider as Record<string, number>) ?? {},
    succeeded: num(outcome.succeeded),
    failed: num(outcome.failed),
  }
}

/* ── Live ops (raw runs, bounded) ─────────────────────────────────────── */

export interface RunRow {
  id: string
  orgId: string
  agentName: string
  status: string
  trigger: string
  provider: string | null
  model: string | null
  startedAt: string | null
  durationMs: number | null
  usdCost: number
  error: string | null
}

function toRunRow(doc: FirebaseFirestore.QueryDocumentSnapshot): RunRow {
  const d = doc.data()
  const metrics = (d.metrics ?? {}) as Record<string, number>
  const error = d.error as { message?: string } | undefined
  return {
    id: doc.id,
    orgId: (d.organizationId as string) ?? doc.ref.parent.parent?.id ?? "",
    agentName: (d.agentName as string) ?? "unknown",
    status: (d.status as string) ?? "unknown",
    trigger: (d.trigger as string) ?? "manual",
    provider: (d.provider as string | null) ?? null,
    model: (d.model as string | null) ?? null,
    startedAt: (d.startedAt as string | null) ?? null,
    durationMs: typeof d.durationMs === "number" ? d.durationMs : null,
    usdCost: num(metrics.usdCost),
    error: error?.message ?? null,
  }
}

export async function listRecentRuns(limit = 50): Promise<RunRow[]> {
  await requirePlatformAdmin()
  const snap = await getAdminDb()
    .collectionGroup("agentRuns")
    .orderBy("startedAt", "desc")
    .limit(limit)
    .get()
  return snap.docs.map(toRunRow)
}

export async function listOrgRuns(orgId: string, limit = 25): Promise<RunRow[]> {
  await requirePlatformAdmin()
  const snap = await getAdminDb()
    .collection(orgAgentRunsPath(orgId))
    .orderBy("startedAt", "desc")
    .limit(limit)
    .get()
  return snap.docs.map(toRunRow)
}

export async function listRunsByStatus(
  statuses: string[],
  limit = 50,
): Promise<RunRow[]> {
  await requirePlatformAdmin()
  const snap = await getAdminDb()
    .collectionGroup("agentRuns")
    .where("status", "in", statuses.slice(0, 10))
    .orderBy("startedAt", "desc")
    .limit(limit)
    .get()
  return snap.docs.map(toRunRow)
}

export interface HourBucket {
  hour: string
  runs: number
  failed: number
}

export interface OpsData {
  statusCounts: Record<string, number>
  inFlight: RunRow[]
  recent: RunRow[]
  failing: RunRow[]
  hourly: HourBucket[]
  latency: LatencyStats
  sampleSize: number
  totalUsd: number
}

const IN_FLIGHT = ["queued", "in_progress", "awaiting_human"]

/* One bounded collectionGroup read, everything for the live-ops console
 * derived in-process: status mix, in-flight + recent + failing feeds, 24h
 * throughput, and latency percentiles. */
export async function getOpsData(sample = 400): Promise<OpsData> {
  await requirePlatformAdmin()
  const snap = await getAdminDb()
    .collectionGroup("agentRuns")
    .orderBy("startedAt", "desc")
    .limit(sample)
    .get()
  const rows = snap.docs.map(toRunRow)

  const statusCounts: Record<string, number> = {}
  for (const r of rows) statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1

  /* 24 hourly buckets ending at the current hour. */
  const now = new Date()
  const buckets: HourBucket[] = []
  const index = new Map<string, HourBucket>()
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 3_600_000)
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${d.getUTCHours()}`
    const b: HourBucket = {
      hour: `${String(d.getUTCHours()).padStart(2, "0")}:00`,
      runs: 0,
      failed: 0,
    }
    buckets.push(b)
    index.set(key, b)
  }
  for (const r of rows) {
    if (!r.startedAt) continue
    const d = new Date(r.startedAt)
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${d.getUTCHours()}`
    const b = index.get(key)
    if (!b) continue
    b.runs += 1
    if (r.status === "failed") b.failed += 1
  }

  const durations = rows
    .map((r) => r.durationMs)
    .filter((v): v is number => typeof v === "number" && v >= 0)
    .sort((a, b) => a - b)
  const at = (q: number) =>
    durations.length
      ? durations[Math.min(durations.length - 1, Math.floor(q * durations.length))]
      : 0

  return {
    statusCounts,
    inFlight: rows.filter((r) => IN_FLIGHT.includes(r.status)).slice(0, 20),
    recent: rows.slice(0, 30),
    failing: rows.filter((r) => r.status === "failed").slice(0, 10),
    hourly: buckets,
    latency: {
      count: durations.length,
      p50: at(0.5),
      p95: at(0.95),
      max: durations.length ? durations[durations.length - 1] : 0,
    },
    sampleSize: rows.length,
    totalUsd: rows.reduce((s, r) => s + r.usdCost, 0),
  }
}

export async function listSignupRequests(
  status: "pending" | "approved" | "denied" = "pending",
  limit = 100,
): Promise<SignupRequest[]> {
  await requirePlatformAdmin()
  const snap = await getAdminDb()
    .collection(platformSignupRequestsPath)
    .where("status", "==", status)
    .limit(limit)
    .get()
  const out: SignupRequest[] = []
  for (const doc of snap.docs) {
    const parsed = signupRequestSchema.safeParse({ ...doc.data(), id: doc.id })
    if (parsed.success) out.push(parsed.data)
  }
  out.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
  return out
}

export async function countPendingSignupRequests(): Promise<number> {
  await requirePlatformAdmin()
  const snap = await getAdminDb()
    .collection(platformSignupRequestsPath)
    .where("status", "==", "pending")
    .count()
    .get()
  return snap.data().count
}

export interface LatencyStats {
  count: number
  p50: number
  p95: number
  max: number
}

export async function latencyStats(sample = 200): Promise<LatencyStats> {
  await requirePlatformAdmin()
  const snap = await getAdminDb()
    .collectionGroup("agentRuns")
    .orderBy("startedAt", "desc")
    .limit(sample)
    .get()
  const durations = snap.docs
    .map((d) => d.data().durationMs)
    .filter((v): v is number => typeof v === "number" && v >= 0)
    .sort((a, b) => a - b)
  if (durations.length === 0) return { count: 0, p50: 0, p95: 0, max: 0 }
  const at = (q: number) =>
    durations[Math.min(durations.length - 1, Math.floor(q * durations.length))]
  return {
    count: durations.length,
    p50: at(0.5),
    p95: at(0.95),
    max: durations[durations.length - 1],
  }
}

export type RealtimeHealthRow = {
  orgId: string
  reason: string
  degradedAt: string
}

export async function listRealtimeHealth(limit = 20): Promise<RealtimeHealthRow[]> {
  await requirePlatformAdmin()
  const snap = await getAdminDb()
    .collection(platformRealtimeHealthPath)
    .orderBy("degradedAt", "desc")
    .limit(limit)
    .get()
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      orgId: (data.orgId as string) ?? d.id,
      reason: (data.reason as string) ?? "unknown",
      degradedAt: (data.degradedAt as string) ?? "",
    }
  })
}

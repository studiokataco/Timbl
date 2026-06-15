import "server-only"

import { getAdminDb } from "@/lib/firebase/admin"
import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import { currentPeriod } from "@/lib/platform/queries"

/*
 * Tenant (org) retention read models. There is no per-user activity log, so
 * "retention" here is org-level: an org counts as active in a period when it
 * recorded at least one agent run. Cohorts are keyed by the org's signup
 * month (createdAt). Everything is derived from the pre-aggregated per-org
 * period + daily rollups - no raw-run scans. Re-asserts platform admin behind
 * the (control) layout guard, defense in depth.
 */

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0
}

function monthIndex(period: string): number {
  const [y, m] = period.split("-").map(Number)
  return y * 12 + (m - 1)
}

function periodFromIndex(idx: number): string {
  const y = Math.floor(idx / 12)
  const m = (idx % 12) + 1
  return `${y}-${String(m).padStart(2, "0")}`
}

function shiftPeriod(period: string, delta: number): string {
  return periodFromIndex(monthIndex(period) + delta)
}

/* collectionGroup names ("periods", "daily") aren't globally unique, so every
 * matched doc is confirmed to live under platform/state/orgRollups before use.
 * Returns the owning orgId, or null if the doc belongs to some other tree. */
function orgIdUnderRollups(
  doc: FirebaseFirestore.QueryDocumentSnapshot,
): string | null {
  const orgDoc = doc.ref.parent.parent
  if (orgDoc?.parent.id !== "orgRollups") return null
  return orgDoc.id
}

export interface CohortRow {
  cohort: string
  size: number
  /* index k = share of the cohort active k months after signup. Length is
   * capped at the months actually elapsed for that cohort - future cells are
   * simply absent rather than rendered as zero. */
  retention: number[]
}

export interface ActiveOrgStats {
  dao: number
  wao: number
  mao: number
  maoPrev: number
  stickiness: number
  newThisMonth: number
  newLastMonth: number
  churnedLastMonth: number
  trend: { month: string; active: number }[]
}

export interface RetentionData {
  cohorts: CohortRow[]
  maxCol: number
  active: ActiveOrgStats
}

function dayKey(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10)
}

const MAX_COHORTS = 12
const MAX_OFFSET = 11
const TREND_MONTHS = 12

export async function getRetentionData(): Promise<RetentionData> {
  await requirePlatformAdmin()
  const db = getAdminDb()
  const windowCutoff = dayKey(59)
  const [orgsSnap, periodsSnap, dailySnap] = await Promise.all([
    db.collection("organizations").get(),
    db.collectionGroup("periods").get(),
    db.collectionGroup("daily").where("date", ">=", windowCutoff).get(),
  ])

  const nowPeriod = currentPeriod()
  const nowIdx = monthIndex(nowPeriod)
  const prevPeriod = shiftPeriod(nowPeriod, -1)

  const cohortOf = new Map<string, string>()
  let newThisMonth = 0
  let newLastMonth = 0
  for (const doc of orgsSnap.docs) {
    const d = doc.data()
    const created =
      (d.createdAt as string) ?? (d.onboarding?.completedAt as string) ?? null
    if (!created || created.length < 7) continue
    const cohort = created.slice(0, 7)
    cohortOf.set(doc.id, cohort)
    if (cohort === nowPeriod) newThisMonth++
    else if (cohort === prevPeriod) newLastMonth++
  }

  const activeMonths = new Map<string, Set<string>>()
  const monthlyActive = new Map<string, Set<string>>()
  for (const doc of periodsSnap.docs) {
    const orgId = orgIdUnderRollups(doc)
    if (!orgId) continue
    const d = doc.data()
    if (num(d.agentRuns) <= 0) continue
    const period = (d.period as string) ?? doc.id
    if (!/^\d{4}-\d{2}$/.test(period)) continue
    ;(activeMonths.get(orgId) ?? activeMonths.set(orgId, new Set()).get(orgId)!).add(
      period,
    )
    ;(
      monthlyActive.get(period) ?? monthlyActive.set(period, new Set()).get(period)!
    ).add(orgId)
  }

  const cohortAgg = new Map<string, { size: number; retained: number[] }>()
  for (const [orgId, cohort] of cohortOf) {
    const cIdx = monthIndex(cohort)
    const agg = cohortAgg.get(cohort) ?? { size: 0, retained: [] }
    agg.size++
    const active = activeMonths.get(orgId)
    if (active) {
      for (const m of active) {
        const k = monthIndex(m) - cIdx
        if (k < 0 || k > MAX_OFFSET) continue
        agg.retained[k] = (agg.retained[k] ?? 0) + 1
      }
    }
    cohortAgg.set(cohort, agg)
  }

  const cohorts: CohortRow[] = [...cohortAgg.entries()]
    .sort((a, b) => monthIndex(a[0]) - monthIndex(b[0]))
    .slice(-MAX_COHORTS)
    .map(([cohort, agg]) => {
      const elapsed = Math.min(MAX_OFFSET, nowIdx - monthIndex(cohort))
      const retention: number[] = []
      for (let k = 0; k <= elapsed; k++) {
        retention.push(agg.size > 0 ? (agg.retained[k] ?? 0) / agg.size : 0)
      }
      return { cohort, size: agg.size, retention }
    })
  const maxCol = cohorts.reduce((m, c) => Math.max(m, c.retention.length), 0)

  const c1 = dayKey(0)
  const c7 = dayKey(6)
  const c30 = dayKey(29)
  const dao = new Set<string>()
  const wao = new Set<string>()
  const mao = new Set<string>()
  const maoPrev = new Set<string>()
  for (const doc of dailySnap.docs) {
    const orgId = orgIdUnderRollups(doc)
    if (!orgId) continue
    const d = doc.data()
    if (num(d.agentRuns) <= 0) continue
    const date = (d.date as string) ?? doc.id
    if (date >= c30) {
      mao.add(orgId)
      if (date >= c7) wao.add(orgId)
      if (date >= c1) dao.add(orgId)
    } else {
      maoPrev.add(orgId)
    }
  }

  const curActive = monthlyActive.get(nowPeriod) ?? new Set<string>()
  const prevActive = monthlyActive.get(prevPeriod) ?? new Set<string>()
  let churnedLastMonth = 0
  for (const orgId of prevActive) if (!curActive.has(orgId)) churnedLastMonth++

  const trend = Array.from({ length: TREND_MONTHS }, (_, i) => {
    const month = shiftPeriod(nowPeriod, i - (TREND_MONTHS - 1))
    return { month, active: monthlyActive.get(month)?.size ?? 0 }
  })

  return {
    cohorts,
    maxCol,
    active: {
      dao: dao.size,
      wao: wao.size,
      mao: mao.size,
      maoPrev: maoPrev.size,
      stickiness: mao.size > 0 ? dao.size / mao.size : 0,
      newThisMonth,
      newLastMonth,
      churnedLastMonth,
      trend,
    },
  }
}

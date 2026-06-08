import { onSchedule } from "firebase-functions/v2/scheduler"
import { logger } from "firebase-functions"
import { getFirestore } from "firebase-admin/firestore"

/*
 * Platform rollup reconciler. Hourly correctness backstop for the
 * best-effort dual-writes in lib/platform/ingest.ts.
 *
 * Reads collectionGroup('usage') - one small doc per org per month, the
 * authoritative quota record - and OVERWRITES the platform rollups +
 * per-org snapshots from it. Cheap because it never touches raw agentRuns.
 *
 * Path strings are inlined: functions/ has its own tsconfig and can't reach
 * @/lib. Keep in sync with lib/platform/schema.ts.
 *   platform/state/rollups/{period}
 *   platform/state/orgRollups/{orgId}
 *   platform/state/orgRollups/{orgId}/periods/{period}
 */

const ROOT = "platform/state"

function currentPeriod(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

type Scalar = {
  usdCost: number
  agentRuns: number
  promptTokens: number
  completionTokens: number
  cachedTokens: number
  embeddingCalls: number
  succeeded: number
  failed: number
}

function emptyScalar(): Scalar {
  return {
    usdCost: 0,
    agentRuns: 0,
    promptTokens: 0,
    completionTokens: 0,
    cachedTokens: 0,
    embeddingCalls: 0,
    succeeded: 0,
    failed: 0,
  }
}

function readScalar(data: FirebaseFirestore.DocumentData): Scalar {
  const outcome = (data.agentRunsByOutcome ?? {}) as Record<string, number>
  return {
    usdCost: num(data.usdCost),
    agentRuns: num(data.agentRuns),
    promptTokens: num(data.promptTokens),
    completionTokens: num(data.completionTokens),
    cachedTokens: num(data.cachedTokens),
    embeddingCalls: num(data.embeddingCalls),
    succeeded: num(outcome.succeeded),
    failed: num(outcome.failed),
  }
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0
}

export const platformRollup = onSchedule(
  {
    schedule: "every 60 minutes",
    timeZone: "UTC",
    region: "asia-south1",
    timeoutSeconds: 120,
    retryCount: 0,
  },
  async () => {
    const db = getFirestore()
    const now = new Date().toISOString()
    const period = currentPeriod()

    const usageSnap = await db.collectionGroup("usage").get()

    /* period -> global scalar, and period -> set of active orgs. */
    const globalByPeriod = new Map<string, Scalar>()
    const activeOrgsByPeriod = new Map<string, Set<string>>()
    /* orgId -> per-period usage doc data, for snapshot + period heal. */
    const orgPeriods = new Map<string, Map<string, FirebaseFirestore.DocumentData>>()

    for (const doc of usageSnap.docs) {
      const orgId = doc.ref.parent.parent?.id
      if (!orgId) continue
      const docPeriod = doc.id
      const data = doc.data()
      const s = readScalar(data)

      const g = globalByPeriod.get(docPeriod) ?? emptyScalar()
      g.usdCost += s.usdCost
      g.agentRuns += s.agentRuns
      g.promptTokens += s.promptTokens
      g.completionTokens += s.completionTokens
      g.cachedTokens += s.cachedTokens
      g.embeddingCalls += s.embeddingCalls
      g.succeeded += s.succeeded
      g.failed += s.failed
      globalByPeriod.set(docPeriod, g)

      if (s.agentRuns > 0) {
        const set = activeOrgsByPeriod.get(docPeriod) ?? new Set<string>()
        set.add(orgId)
        activeOrgsByPeriod.set(docPeriod, set)
      }

      const perOrg = orgPeriods.get(orgId) ?? new Map()
      perOrg.set(docPeriod, data)
      orgPeriods.set(orgId, perOrg)
    }

    /* 1. Global rollups - overwrite scalar fields per period. byModel /
     * byProvider maps are left to the dual-write (merge preserves them). */
    let globalWrites = 0
    for (const [p, s] of globalByPeriod) {
      await db.doc(`${ROOT}/rollups/${p}`).set(
        {
          period: p,
          usdCost: s.usdCost,
          agentRuns: s.agentRuns,
          promptTokens: s.promptTokens,
          completionTokens: s.completionTokens,
          cachedTokens: s.cachedTokens,
          embeddingCalls: s.embeddingCalls,
          runsByOutcome: { succeeded: s.succeeded, failed: s.failed },
          activeOrgs: activeOrgsByPeriod.get(p)?.size ?? 0,
          updatedAt: now,
        },
        { merge: true },
      )
      globalWrites++
    }

    /* 2. Per-org snapshot + period heal. */
    let orgWrites = 0
    for (const [orgId, perOrg] of orgPeriods) {
      const orgDoc = await db.doc(`organizations/${orgId}`).get()
      const org = orgDoc.data() ?? {}
      const usersSnap = await db.collection(`organizations/${orgId}/users`).get()
      const seats = usersSnap.size

      const cur = perOrg.get(period)
      const curScalar = cur ? readScalar(cur) : emptyScalar()
      const totalOutcome = curScalar.succeeded + curScalar.failed
      const failureRate = totalOutcome > 0 ? curScalar.failed / totalOutcome : 0

      await db.doc(`${ROOT}/orgRollups/${orgId}`).set(
        {
          orgId,
          name: (org.name as string) ?? orgId,
          plan: (org.plan as string) ?? "agency_v1",
          status: (org.status as string) ?? "active",
          seats,
          mtdUsdCost: curScalar.usdCost,
          mtdAgentRuns: curScalar.agentRuns,
          failureRate,
          onboardingCompletedAt:
            (org.onboarding as { completedAt?: string } | undefined)?.completedAt ??
            null,
          updatedAt: now,
        },
        { merge: true },
      )

      /* Heal each per-org period doc's scalar fields from the authoritative
       * usage doc (maps preserved via merge). */
      for (const [p, data] of perOrg) {
        const s = readScalar(data)
        await db.doc(`${ROOT}/orgRollups/${orgId}/periods/${p}`).set(
          {
            period: p,
            usdCost: s.usdCost,
            agentRuns: s.agentRuns,
            promptTokens: s.promptTokens,
            completionTokens: s.completionTokens,
            cachedTokens: s.cachedTokens,
            runsByOutcome: { succeeded: s.succeeded, failed: s.failed },
            byModel: (data.usdByModel as Record<string, number>) ?? {},
            byProvider: (data.usdByProvider as Record<string, number>) ?? {},
            updatedAt: now,
          },
          { merge: true },
        )
      }
      orgWrites++
    }

    logger.info("[platformRollup] reconciled", {
      usageDocs: usageSnap.size,
      globalWrites,
      orgWrites,
      at: now,
    })
  },
)

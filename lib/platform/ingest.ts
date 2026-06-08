import "server-only"

import { FieldValue } from "firebase-admin/firestore"

import { getAdminDb } from "@/lib/firebase/admin"
import {
  platformOrgRollupDailyDocPath,
  platformOrgRollupDocPath,
  platformOrgRollupPeriodDocPath,
  platformRollupDocPath,
  safeFieldKey,
} from "@/lib/platform/schema"

/*
 * Cross-org rollup dual-writes. Called from emitAgentRun (the single agent
 * telemetry insertion point) so every terminal run that lands in an org's
 * usage doc also lands in the platform-level rollups the control centre
 * reads. All writes are best-effort - a rollup-write failure must never
 * break a user's run. The scheduled reconciler (functions/platformRollup)
 * is the correctness backstop and overwrites the scalar fields from the
 * authoritative org usage docs.
 *
 * Targets per run (4 increment writes):
 *   platform/state/rollups/{period}                       global
 *   platform/state/orgRollups/{orgId}/periods/{period}    per-org month
 *   platform/state/orgRollups/{orgId}/daily/{date}        per-org day
 *   platform/state/orgRollups/{orgId}                      snapshot (lastRunAt)
 */

export interface PlatformRunRecord {
  orgId: string
  period: string
  date: string
  outcome: "succeeded" | "failed"
  usdCost: number
  promptTokens: number
  completionTokens: number
  cachedTokens: number
  provider: string | null
  model: string | null
}

export async function recordPlatformRun(rec: PlatformRunRecord): Promise<void> {
  const db = getAdminDb()
  const now = new Date().toISOString()
  const providerKey = rec.provider ? safeFieldKey(rec.provider) : "unknown"
  const modelKey = rec.model ? safeFieldKey(rec.model) : "unknown"

  const scalar = {
    usdCost: FieldValue.increment(rec.usdCost),
    agentRuns: FieldValue.increment(1),
    promptTokens: FieldValue.increment(rec.promptTokens),
    completionTokens: FieldValue.increment(rec.completionTokens),
    cachedTokens: FieldValue.increment(rec.cachedTokens),
    [`runsByOutcome.${rec.outcome}`]: FieldValue.increment(1),
    [`byProvider.${providerKey}`]: FieldValue.increment(rec.usdCost),
    [`byModel.${modelKey}`]: FieldValue.increment(rec.usdCost),
    [`modelNames.${modelKey}`]: rec.model ?? "unknown",
    updatedAt: now,
  }

  await Promise.all([
    db
      .doc(platformRollupDocPath(rec.period))
      .set({ period: rec.period, ...scalar }, { merge: true }),
    db
      .doc(platformOrgRollupPeriodDocPath(rec.orgId, rec.period))
      .set({ period: rec.period, ...scalar }, { merge: true }),
    db.doc(platformOrgRollupDailyDocPath(rec.orgId, rec.date)).set(
      {
        date: rec.date,
        orgId: rec.orgId,
        usdCost: FieldValue.increment(rec.usdCost),
        agentRuns: FieldValue.increment(1),
        [`byProvider.${providerKey}`]: FieldValue.increment(rec.usdCost),
        [`byModel.${modelKey}`]: FieldValue.increment(rec.usdCost),
        [`modelNames.${modelKey}`]: rec.model ?? "unknown",
        updatedAt: now,
      },
      { merge: true },
    ),
    db
      .doc(platformOrgRollupDocPath(rec.orgId))
      .set({ orgId: rec.orgId, lastRunAt: now, updatedAt: now }, { merge: true }),
  ])
}

/* Embedding metering. Embeddings are mostly free (Gemini) so we count calls
 * rather than cost - it's the volume signal the control centre surfaces. */
export async function recordPlatformEmbedding(
  orgId: string,
  period: string,
): Promise<void> {
  const db = getAdminDb()
  const now = new Date().toISOString()
  await Promise.all([
    db
      .doc(platformRollupDocPath(period))
      .set(
        { period, embeddingCalls: FieldValue.increment(1), updatedAt: now },
        { merge: true },
      ),
    db
      .doc(platformOrgRollupPeriodDocPath(orgId, period))
      .set(
        { period, embeddingCalls: FieldValue.increment(1), updatedAt: now },
        { merge: true },
      ),
  ])
}

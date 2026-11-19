"use server"

import { getAdminDb } from "@/lib/firebase/admin"
import { emitRunSpendCorrection } from "@/lib/telemetry/agent-events"
import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import {
  getOpenRouterAccount,
  fetchGenerationCost,
  type OpenRouterAccount,
} from "@/lib/platform/openrouter"

/*
 * OpenRouter billing actions for the control centre. The management key is
 * read server-side only (lib/platform/openrouter.ts); every action re-gates
 * with requirePlatformAdmin because actions are POST-invocable independently
 * of the layout that also gates.
 */

export async function getOpenRouterAccountAction(): Promise<OpenRouterAccount | null> {
  await requirePlatformAdmin()
  return getOpenRouterAccount()
}

export interface ReconcileResult {
  ok: boolean
  scanned: number
  reconciled: number
  error?: string
}

/*
 * Backfills exact cost on recent OpenRouter runs whose run-end cost was an
 * estimate, by summing GET /generation per generation id. Runs metered on
 * OpenRouter's inline cost already carry actualUsdCost and are skipped. The
 * difference from the recorded cost is applied to the usage counters too, so
 * the spend gates and every control-centre total move with it. Bounded scan,
 * best-effort: ids whose cost hasn't settled yet are left for the next pass.
 */
export async function reconcileRunCosts(sample = 100): Promise<ReconcileResult> {
  await requirePlatformAdmin()
  let scanned = 0
  let reconciled = 0
  try {
    const snap = await getAdminDb()
      .collectionGroup("agentRuns")
      .orderBy("startedAt", "desc")
      .limit(sample)
      .get()

    for (const doc of snap.docs) {
      const data = doc.data() as {
        generationIds?: string[]
        metrics?: { actualUsdCost?: number; usdCost?: number }
        organizationId?: string
        agentName?: string
        provider?: string | null
        model?: string | null
        startedAt?: string
      }
      const ids = data.generationIds ?? []
      if (ids.length === 0) continue
      if (typeof data.metrics?.actualUsdCost === "number") continue
      scanned += 1

      const costs = await Promise.all(ids.map((id) => fetchGenerationCost(id)))
      /* Only commit once every generation in the run has settled - a partial
       * sum would understate spend and never get corrected. */
      if (costs.some((c) => c === null)) continue
      const total = costs.reduce((sum, c) => sum + (c?.totalCost ?? 0), 0)

      /* Nested object, not a "metrics.x" key: set(merge) writes a dotted
       * string as a literal top-level field. */
      await doc.ref.set(
        {
          metrics: { actualUsdCost: total, usdCost: total, costSource: "provider" },
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      )
      const deltaUsd = total - (data.metrics?.usdCost ?? 0)
      const orgId = data.organizationId ?? doc.ref.parent.parent?.id
      if (orgId && Math.abs(deltaUsd) > 1e-9) {
        await emitRunSpendCorrection({
          orgId,
          agentName: data.agentName ?? "unknown",
          deltaUsd,
          provider: data.provider ?? null,
          model: data.model ?? null,
          at: data.startedAt ? new Date(data.startedAt) : new Date(),
        })
      }
      reconciled += 1
    }
    return { ok: true, scanned, reconciled }
  } catch (err) {
    return {
      ok: false,
      scanned,
      reconciled,
      error: err instanceof Error ? err.message : "reconcile_failed",
    }
  }
}

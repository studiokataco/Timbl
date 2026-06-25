"use server"

import { getAdminDb } from "@/lib/firebase/admin"
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
 * Backfills metrics.actualUsdCost on recent OpenRouter runs by summing the
 * exact per-generation cost from GET /generation. The estimate written at
 * run end stays in metrics.usdCost; actualUsdCost is the authoritative spend
 * number. Bounded scan, best-effort: ids whose cost hasn't settled yet are
 * left for the next pass.
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
        metrics?: { actualUsdCost?: number }
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

      await doc.ref.set(
        { "metrics.actualUsdCost": total, updatedAt: new Date().toISOString() },
        { merge: true },
      )
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

import "server-only"

import { FieldValue } from "firebase-admin/firestore"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgUsageDocPath } from "@/lib/firebase/paths"
import { recordPlatformEmbedding, recordPlatformRun } from "@/lib/platform/ingest"
import { safeFieldKey } from "@/lib/platform/schema"

/*
 * Agent-run telemetry. Single insertion point so the quota counter (used
 * by lib/plans/gate.ts:requireQuota) and any downstream metering (Razorpay
 * usage reconciliation in Phase H) stay in lockstep.
 *
 * Called from markAgentRunStatus when a run transitions to a terminal
 * state. Quota is incremented for BOTH `succeeded` and `failed` because:
 *
 *   - LLM calls were made (and billed by Anthropic/Google) either way
 *   - A user-side retry of a failed run shouldn't be free-money
 *
 * Cancelled runs do not count.
 *
 * Counter writes are best-effort (try/catch around the call site) - a
 * usage-write failure must not break the user's UI. The Razorpay
 * reconciliation (when it lands) is async and never blocks either.
 */

export type AgentRunOutcome = "succeeded" | "failed"

export interface AgentRunEvent {
  orgId: string
  runId: string
  agentName: string
  outcome: AgentRunOutcome
  promptTokens?: number
  completionTokens?: number
  cachedTokens?: number
  usdCost?: number
  /* The provider + model the run used. Mirrored into the platform rollups
   * so the control centre can break cost down by model/provider. Captured
   * on the agentRuns doc at start; passed through here by markAgentRunStatus. */
  provider?: string | null
  model?: string | null
}

function currentPeriod(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

function currentDate(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

export async function emitAgentRun(event: AgentRunEvent): Promise<void> {
  const period = currentPeriod()
  const ref = getAdminDb().doc(orgUsageDocPath(event.orgId, period))

  const usdCost = event.usdCost ?? 0
  const promptTokens = event.promptTokens ?? 0
  const completionTokens = event.completionTokens ?? 0
  const cachedTokens = event.cachedTokens ?? 0
  const providerKey = event.provider ? safeFieldKey(event.provider) : "unknown"
  const modelKey = event.model ? safeFieldKey(event.model) : "unknown"

  /* Atomic increment so concurrent runs don't lose counts. The per-key maps
   * are written as nested objects (not "map.key" string keys): set(merge)
   * treats a dotted string as a literal field name, so only nested objects
   * deep-merge into real maps. FieldValue.increment composes inside them. */
  await ref.set(
    {
      period,
      organizationId: event.orgId,
      agentRuns: FieldValue.increment(1),
      agentRunsByAgent: { [event.agentName]: FieldValue.increment(1) },
      agentRunsByOutcome: { [event.outcome]: FieldValue.increment(1) },
      tokensByAgent: {
        [event.agentName]: FieldValue.increment(promptTokens + completionTokens),
      },
      usdByAgent: { [event.agentName]: FieldValue.increment(usdCost) },
      promptTokens: FieldValue.increment(promptTokens),
      completionTokens: FieldValue.increment(completionTokens),
      cachedTokens: FieldValue.increment(cachedTokens),
      usdCost: FieldValue.increment(usdCost),
      usdByProvider: { [providerKey]: FieldValue.increment(usdCost) },
      usdByModel: { [modelKey]: FieldValue.increment(usdCost) },
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  )

  /* Cross-org rollup dual-write. Best-effort: the control centre is not
   * load-bearing for the user's run, and the scheduled reconciler heals
   * any write lost here. */
  try {
    await recordPlatformRun({
      orgId: event.orgId,
      period,
      date: currentDate(),
      outcome: event.outcome,
      usdCost,
      promptTokens,
      completionTokens,
      cachedTokens,
      provider: event.provider ?? null,
      model: event.model ?? null,
    })
  } catch (err) {
    console.warn(
      `[platform-rollup] dual-write failed org=${event.orgId} run=${event.runId}: ${err instanceof Error ? err.message : err}`,
    )
  }
}

/* Embedding telemetry. Increments the org usage counter and the platform
 * rollup. Best-effort and fire-and-forget - never blocks the embed write. */
export async function emitEmbeddingCall(orgId: string): Promise<void> {
  const period = currentPeriod()
  try {
    await getAdminDb()
      .doc(orgUsageDocPath(orgId, period))
      .set(
        {
          period,
          organizationId: orgId,
          embeddingCalls: FieldValue.increment(1),
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      )
    await recordPlatformEmbedding(orgId, period)
  } catch (err) {
    console.warn(
      `[platform-rollup] embedding meter failed org=${orgId}: ${err instanceof Error ? err.message : err}`,
    )
  }
}

/* Increment a single metric on the current-period usage doc. Used by
 * non-agent surfaces (post scheduling, future brand/seat creates) so
 * quota counters stay in sync. Best-effort like emitAgentRun. */
export async function incrementUsage(
  orgId: string,
  metric: "scheduledPosts" | "brands" | "seats",
  by = 1,
): Promise<void> {
  const period = currentPeriod()
  await getAdminDb()
    .doc(orgUsageDocPath(orgId, period))
    .set(
      {
        period,
        organizationId: orgId,
        [metric]: FieldValue.increment(by),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    )
}

/* Helper: read a usage doc shape consumers can dashboard against. */
export interface UsageSnapshot {
  period: string
  agentRuns: number
  scheduledPosts: number
  promptTokens: number
  completionTokens: number
  cachedTokens: number
  usdCost: number
  agentRunsByAgent: Record<string, number>
  agentRunsByOutcome: Record<string, number>
  tokensByAgent: Record<string, number>
  usdByAgent: Record<string, number>
  usdByModel: Record<string, number>
  usdByProvider: Record<string, number>
}

export async function readUsageSnapshot(
  orgId: string,
  period = currentPeriod(),
): Promise<UsageSnapshot> {
  const snap = await getAdminDb().doc(orgUsageDocPath(orgId, period)).get()
  const data = snap.data() ?? {}
  return {
    period,
    agentRuns: (data.agentRuns as number) ?? 0,
    scheduledPosts: (data.scheduledPosts as number) ?? 0,
    promptTokens: (data.promptTokens as number) ?? 0,
    completionTokens: (data.completionTokens as number) ?? 0,
    cachedTokens: (data.cachedTokens as number) ?? 0,
    usdCost: (data.usdCost as number) ?? 0,
    agentRunsByAgent: (data.agentRunsByAgent as Record<string, number>) ?? {},
    agentRunsByOutcome: (data.agentRunsByOutcome as Record<string, number>) ?? {},
    tokensByAgent: (data.tokensByAgent as Record<string, number>) ?? {},
    usdByAgent: (data.usdByAgent as Record<string, number>) ?? {},
    usdByModel: (data.usdByModel as Record<string, number>) ?? {},
    usdByProvider: (data.usdByProvider as Record<string, number>) ?? {},
  }
}

import "server-only"

import { FieldValue } from "firebase-admin/firestore"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgUsageDocPath } from "@/lib/firebase/paths"

/*
 * Agent-run telemetry. Single insertion point so the quota counter (used
 * by lib/plans/gate.ts:requireQuota) and any downstream metering (Stripe
 * Meter Events in Phase H) stay in lockstep.
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
 * usage-write failure must not break the user's UI. The Stripe push (when
 * it lands) is async-reconciled and never blocks either.
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
}

function currentPeriod(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

export async function emitAgentRun(event: AgentRunEvent): Promise<void> {
  const period = currentPeriod()
  const ref = getAdminDb().doc(orgUsageDocPath(event.orgId, period))

  /* Atomic increment so concurrent runs don't lose counts. setDoc(merge)
   * + FieldValue.increment is the documented Admin SDK pattern for this. */
  await ref.set(
    {
      period,
      organizationId: event.orgId,
      agentRuns: FieldValue.increment(1),
      [`agentRunsByAgent.${event.agentName}`]: FieldValue.increment(1),
      [`agentRunsByOutcome.${event.outcome}`]: FieldValue.increment(1),
      promptTokens: FieldValue.increment(event.promptTokens ?? 0),
      completionTokens: FieldValue.increment(event.completionTokens ?? 0),
      cachedTokens: FieldValue.increment(event.cachedTokens ?? 0),
      usdCost: FieldValue.increment(event.usdCost ?? 0),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  )
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
  }
}

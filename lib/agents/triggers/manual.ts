import { randomUUID } from "node:crypto"
import type { Content } from "@google/genai"
import { FieldValue } from "firebase-admin/firestore"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgAgentRunsPath } from "@/lib/firebase/paths"
import { DEFAULT_BRAND_ID } from "@/lib/constants/timbl"
import {
  requireActiveBilling,
  requireAgentBudget,
  requireOrgBudget,
  requireQuota,
} from "@/lib/plans/gate"
import { writePlatformSignal } from "@/lib/platform/signals"
import { emitAgentRun } from "@/lib/telemetry/agent-events"
import { estimateUsdCost } from "@/lib/agents/pricing"
import type { AgentRunError } from "@/lib/schemas/agentRun"

import { resolveAgent, type ResolveOverride } from ".."
import { AGENT_APP_NAME, buildRunner } from "../runtime/runner"
import { FirestoreSessionService } from "../runtime/session-service"
import { RUNTIME_STATE_KEY, type RuntimeCtx } from "../runtime/context"

/*
 * The single entrypoint that every code path (UI button, cron tick,
 * pipeline sub-step) goes through to launch an agent run. Writes the
 * agentRuns doc with status=queued, creates a session keyed by runId, and
 * returns everything the streaming Route Handler needs to call
 * runner.runAsync().
 *
 * State is pre-seeded with `_runtime` so any tool invoked during the run
 * can read RuntimeCtx via getRuntimeCtx(ctx).
 */

export interface StartRunInput {
  orgId: string
  userId: string
  agentName: string
  input: string
  trigger: "manual" | "cron" | "pipeline"
  /** Which brand this run acts on. Optional through the rollout - absent means
   * the org's default brand. */
  brandId?: string
  dedupKey?: string
  parentRunId?: string
  /** Per-conversation override of the agent's saved provider/model. Does
   * not mutate the agentConfig doc - only affects this run. */
  override?: ResolveOverride
}

export interface StartRunResult {
  runId: string
  sessionId: string
  userId: string
  agentName: string
  appName: string
  newMessage: Content
  /** Resolved provider/model this run is executing on, so a caller recording
   * a failure can name the upstream without re-reading the run doc. */
  provider: string
  model: string
  /** Returned for the route handler / pipeline driver to iterate. */
  runner: ReturnType<typeof buildRunner>
}

export async function startAgentRun(
  input: StartRunInput,
): Promise<StartRunResult> {
  /* Dunning gate: a past_due subscription blocks new runs until payment is
   * fixed (the webhook sets billingStatus). Checked before quota so a lapsed
   * payer gets the billing message, not a quota message. */
  await requireActiveBilling(input.orgId)

  /* Plan gate: every run, regardless of trigger, counts against the
   * agentRuns quota. Throws PlanGateError on overage; the route handler
   * surfaces it to the UI as a structured upsell. Cron triggers also
   * gate so a runaway schedule can't burn through a billing period. */
  await requireQuota(input.orgId, "agentRuns")

  /* Needs only the orgId, so it runs before resolveAgent - a blocked run
   * never pays for agent resolution. */
  await requireOrgBudget(input.orgId)

  const resolved = await resolveAgent(
    input.orgId,
    input.agentName,
    input.override,
  )
  if (!resolved) {
    throw new Error(
      `Unknown or unconfigured agent: ${input.agentName}. Did you seed agentConfigs?`,
    )
  }

  /* Per-agent gate: tier-scaled invocation cap + monthlyUsdCap, on top of
   * the blanket agentRuns quota above. See requireAgentBudget for why this
   * needs the resolved config's budgets and so can't run earlier. */
  await requireAgentBudget(
    input.orgId,
    input.agentName,
    resolved.config.budgets.monthlyUsdCap,
  )

  const runId = randomUUID()
  const sessionId = runId // 1:1 sessions and runs in v1 - simpler audit trail.

  const runtimeCtx: RuntimeCtx = {
    orgId: input.orgId,
    userId: input.userId,
    runId,
    agentName: input.agentName,
    brandId: input.brandId ?? DEFAULT_BRAND_ID,
  }

  const sessionService = new FirestoreSessionService(input.orgId)
  await sessionService.createSession({
    appName: AGENT_APP_NAME,
    userId: input.userId,
    sessionId,
    state: {
      [RUNTIME_STATE_KEY]: runtimeCtx,
      agentName: input.agentName,
    },
  })

  await getAdminDb()
    .collection(orgAgentRunsPath(input.orgId))
    .doc(runId)
    .set({
      id: runId,
      organizationId: input.orgId,
      brandId: input.brandId ?? DEFAULT_BRAND_ID,
      agentName: input.agentName,
      sessionId,
      userId: input.userId,
      trigger: input.trigger,
      status: "queued",
      /* Record the model the run uses so a prod-swap A/B can compare it
       * against the prior model's runs (§6.6). Taken from the resolved
       * agentConfig - the source of truth the runner was built from. */
      provider: resolved.config.provider,
      model: resolved.config.model,
      startedAt: new Date().toISOString(),
      inputSummary: input.input.slice(0, 2_000),
      outputs: { postIds: [], ideationItemIds: [] },
      metrics: {
        llmCalls: 0,
        toolCalls: 0,
        promptTokens: 0,
        completionTokens: 0,
        cachedTokens: 0,
        usdCost: 0,
      },
      parentRunId: input.parentRunId ?? null,
      dedupKey: input.dedupKey ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

  const runner = buildRunner({ orgId: input.orgId, agent: resolved.agent })

  return {
    runId,
    sessionId,
    userId: input.userId,
    agentName: input.agentName,
    appName: AGENT_APP_NAME,
    newMessage: {
      role: "user",
      parts: [{ text: input.input }],
    },
    provider: resolved.config.provider,
    model: resolved.config.model,
    runner,
  }
}

export interface MarkRunStatusInput {
  orgId: string
  runId: string
  status: "in_progress" | "succeeded" | "failed" | "cancelled" | "awaiting_human"
  error?: AgentRunError
  metricsPatch?: Record<string, number>
  outputsPatch?: { postIds?: string[]; ideationItemIds?: string[] }
  /** OpenRouter generation handles collected across the run's LLM calls. */
  generationIds?: string[]
  /** Web-search citation URLs collected across the run. */
  sourceUrls?: string[]
}

export async function markAgentRunStatus(input: MarkRunStatusInput) {
  const ref = getAdminDb()
    .collection(orgAgentRunsPath(input.orgId))
    .doc(input.runId)
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    status: input.status,
    updatedAt: now,
  }
  if (input.status === "succeeded" || input.status === "failed" || input.status === "cancelled") {
    patch.finishedAt = now
  }
  if (input.error) patch.error = input.error
  /* Nested objects, not "metrics.key" / "outputs.key" strings: set(merge)
   * writes a dotted string as a literal flat field, leaving the real nested
   * map untouched. Merge deep-merges these, so only the listed keys change. */
  if (input.metricsPatch) {
    patch.metrics = { ...input.metricsPatch }
  }
  if (input.outputsPatch?.postIds || input.outputsPatch?.ideationItemIds) {
    patch.outputs = {
      ...(input.outputsPatch.postIds ? { postIds: input.outputsPatch.postIds } : {}),
      ...(input.outputsPatch.ideationItemIds
        ? { ideationItemIds: input.outputsPatch.ideationItemIds }
        : {}),
    }
  }
  /* arrayUnion so a resumed run (same id, second route invocation) appends
   * its generation ids / citations rather than clobbering the first leg. */
  if (input.generationIds?.length) {
    patch.generationIds = FieldValue.arrayUnion(...input.generationIds)
  }
  if (input.sourceUrls?.length) {
    patch.sourceUrls = FieldValue.arrayUnion(...input.sourceUrls)
  }
  await ref.set(patch, { merge: true })

  /* Telemetry: emit on terminal state. Succeeded + failed both count
   * against quota (LLM tokens were burned either way). Cancelled doesn't.
   * Best-effort - a counter-write failure must not break the UI flow. */
  if (input.status === "succeeded" || input.status === "failed") {
    try {
      const snap = await ref.get()
      const data = snap.data() ?? {}
      const m = (data.metrics ?? {}) as Record<string, number | undefined>
      const promptTokens = m.promptTokens ?? 0
      const completionTokens = m.completionTokens ?? 0
      const cachedTokens = m.cachedTokens ?? 0
      /* usdCost is derived here (not during streaming) - it's the only place
       * the model id and the final token counts are both known. Cache reads
       * are discounted inside estimateUsdCost. Written back so the run doc
       * carries a real cost, not the 0 placeholder seeded at start. */
      const usdCost = estimateUsdCost(
        (data.model as string | undefined) ?? null,
        promptTokens,
        completionTokens,
        cachedTokens,
      )
      /* Wall-clock duration - finishedAt minus startedAt. The field existed
       * on the schema but was never written; live-ops latency (p50/p95)
       * reads it. */
      const startedAt = data.startedAt as string | undefined
      const durationMs = startedAt
        ? Math.max(0, Date.parse(now) - Date.parse(startedAt))
        : undefined
      await ref.set(
        durationMs === undefined
          ? { metrics: { usdCost } }
          : { metrics: { usdCost }, durationMs },
        { merge: true },
      )
      await emitAgentRun({
        orgId: input.orgId,
        runId: input.runId,
        agentName: (data.agentName as string) ?? "unknown",
        outcome: input.status,
        promptTokens,
        completionTokens,
        cachedTokens,
        usdCost,
        provider: (data.provider as string | null | undefined) ?? null,
        model: (data.model as string | null | undefined) ?? null,
        /* A failure with no tokens on the clock never reached the model -
         * provider quota, connection reset, missing key. It must not eat the
         * per-agent invocation cap. */
        chargeable:
          input.status === "succeeded" ||
          promptTokens + completionTokens > 0,
      })
      if (input.status === "failed") {
        const agentName = (data.agentName as string) ?? "unknown"
        void writePlatformSignal({
          id: `agent-fail-${input.runId}`,
          kind: "agent.failed",
          orgId: input.orgId,
          summary: `${agentName} run failed`,
          meta: {
            runId: input.runId,
            agentName,
            error: input.error?.message ?? null,
            errorName: input.error?.name ?? null,
            lastGenerationId: input.error?.lastGenerationId ?? null,
            clientDisconnected: input.error?.clientDisconnected ?? null,
            model: (data.model as string | null | undefined) ?? null,
            provider: (data.provider as string | null | undefined) ?? null,
          },
        }).catch(() => {})
      }
    } catch (err) {
      console.warn(
        `[agent-events] emit failed for run=${input.runId}: ${err instanceof Error ? err.message : err}`,
      )
    }
  }
}

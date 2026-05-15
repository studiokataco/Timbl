import { randomUUID } from "node:crypto"
import type { Content } from "@google/genai"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgAgentRunsPath } from "@/lib/firebase/paths"

import { resolveAgent } from ".."
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
  dedupKey?: string
  parentRunId?: string
}

export interface StartRunResult {
  runId: string
  sessionId: string
  userId: string
  agentName: string
  appName: string
  newMessage: Content
  /** Returned for the route handler / pipeline driver to iterate. */
  runner: ReturnType<typeof buildRunner>
}

export async function startAgentRun(
  input: StartRunInput,
): Promise<StartRunResult> {
  const resolved = await resolveAgent(input.orgId, input.agentName)
  if (!resolved) {
    throw new Error(
      `Unknown or unconfigured agent: ${input.agentName}. Did you seed agentConfigs?`,
    )
  }

  const runId = randomUUID()
  const sessionId = runId // 1:1 sessions and runs in v1 — simpler audit trail.

  const runtimeCtx: RuntimeCtx = {
    orgId: input.orgId,
    userId: input.userId,
    runId,
    agentName: input.agentName,
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
      agentName: input.agentName,
      sessionId,
      userId: input.userId,
      trigger: input.trigger,
      status: "queued",
      startedAt: new Date().toISOString(),
      inputSummary: input.input.slice(0, 2_000),
      outputs: { postIds: [], ideationItemIds: [] },
      metrics: {
        llmCalls: 0,
        toolCalls: 0,
        promptTokens: 0,
        completionTokens: 0,
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
    runner,
  }
}

export interface MarkRunStatusInput {
  orgId: string
  runId: string
  status: "in_progress" | "succeeded" | "failed" | "cancelled" | "awaiting_human"
  error?: { code: string; message: string }
  metricsPatch?: Record<string, number>
  outputsPatch?: { postIds?: string[]; ideationItemIds?: string[] }
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
  if (input.metricsPatch) {
    for (const [k, v] of Object.entries(input.metricsPatch)) {
      patch[`metrics.${k}`] = v
    }
  }
  if (input.outputsPatch?.postIds) {
    patch["outputs.postIds"] = input.outputsPatch.postIds
  }
  if (input.outputsPatch?.ideationItemIds) {
    patch["outputs.ideationItemIds"] = input.outputsPatch.ideationItemIds
  }
  await ref.set(patch, { merge: true })
}

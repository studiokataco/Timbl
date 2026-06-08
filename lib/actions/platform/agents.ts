"use server"

import { z } from "zod"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgAgentRunsPath } from "@/lib/firebase/paths"
import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import { writePlatformAudit } from "@/lib/platform/audit"
import { startAgentRun, markAgentRunStatus } from "@/lib/agents/triggers/manual"
import { SYSTEM_USER } from "@/lib/agents/triggers/system-user"

import type { PlatformActionResult } from "./orgs"

const forceInput = z.object({
  orgId: z.string().min(1),
  agentName: z.string().min(1),
  input: z.string().max(10_000).default("control-centre force run"),
})

/* Force a run in any org, under SYSTEM_USER. Drives the run to completion in
 * the background (same drain pattern as the cron tick) so the control centre
 * doesn't block on it. */
export async function forceRunAgent(raw: unknown): Promise<PlatformActionResult & { runId?: string }> {
  const actor = await requirePlatformAdmin()
  if (actor.role !== "owner") return { ok: false, error: "forbidden" }
  const parsed = forceInput.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { orgId, agentName, input } = parsed.data

  let started
  try {
    started = await startAgentRun({
      orgId,
      userId: SYSTEM_USER.id,
      agentName,
      input,
      trigger: "manual",
    })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "start_failed" }
  }

  await markAgentRunStatus({ orgId, runId: started.runId, status: "in_progress" })
  await writePlatformAudit({
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "agent.force_run",
    targetOrgId: orgId,
    target: { type: "agent", id: agentName },
    meta: { runId: started.runId },
  })

  void (async () => {
    try {
      for await (const _ev of started.runner.runAsync({
        userId: started.userId,
        sessionId: started.sessionId,
        newMessage: started.newMessage,
      })) {
        void _ev
      }
      await markAgentRunStatus({ orgId, runId: started.runId, status: "succeeded" })
    } catch (err) {
      await markAgentRunStatus({
        orgId,
        runId: started.runId,
        status: "failed",
        error: {
          code: "agent_error",
          message: err instanceof Error ? err.message : String(err),
        },
      })
    }
  })()

  return { ok: true, runId: started.runId }
}

const cancelInput = z.object({
  orgId: z.string().min(1),
  runId: z.string().min(1),
})

export async function cancelRunInOrg(raw: unknown): Promise<PlatformActionResult> {
  const actor = await requirePlatformAdmin()
  if (actor.role !== "owner") return { ok: false, error: "forbidden" }
  const parsed = cancelInput.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { orgId, runId } = parsed.data

  const ref = getAdminDb().collection(orgAgentRunsPath(orgId)).doc(runId)
  if (!(await ref.get()).exists) return { ok: false, error: "run_not_found" }
  await ref.set(
    {
      status: "cancelled",
      finishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  )
  await writePlatformAudit({
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "agent.cancel",
    targetOrgId: orgId,
    target: { type: "agentRun", id: runId },
  })
  return { ok: true }
}

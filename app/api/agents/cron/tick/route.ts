import type { NextRequest } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { z } from "zod"

import { getAdminDb } from "@/lib/firebase/admin"
import {
  orgAgentConfigsPath,
  orgAgentRunsPath,
} from "@/lib/firebase/paths"
import { agentConfigSchema } from "@/lib/schemas/agentConfig"
import { startAgentRun, markAgentRunStatus } from "@/lib/agents/triggers/manual"
import { SYSTEM_USER } from "@/lib/agents/triggers/system-user"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({
  orgId: z.string().min(1),
  agentName: z.string().min(1),
  input: z.string().max(10_000).default("scheduled run"),
})

/*
 * Cron entrypoint - fires a single agent's run on the local cron script's
 * schedule (Phase 8) or on Cloud Scheduler in Phase 7+. Always runs under
 * SYSTEM_USER so the audit trail in agentRuns distinguishes scheduled
 * from human-triggered work.
 *
 * Secret check: X-Agent-Cron-Secret must match AGENT_CRON_SECRET. The
 * shared secret is intentionally a single value rather than a signed
 * token - this endpoint is local-only until Phase 7 and a per-request
 * signature scheme is premature.
 *
 * No streaming response: cron fires and forgets. The run continues in
 * the background; clients watch /settings/runs to see progress.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-agent-cron-secret")
  const expected = process.env.AGENT_CRON_SECRET
  if (!expected) {
    return Response.json(
      { ok: false, error: "AGENT_CRON_SECRET not configured" },
      { status: 503 },
    )
  }
  /* Constant-time check. timingSafeEqual throws on unequal lengths, so the
   * length pre-check guards it. Leaking the secret's length is fine - the
   * secret is service-managed and not user-supplied. */
  const a = Buffer.from(secret ?? "", "utf8")
  const b = Buffer.from(expected, "utf8")
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  let payload: z.infer<typeof bodySchema>
  try {
    payload = bodySchema.parse(await req.json())
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Invalid body" },
      { status: 400 },
    )
  }

  /* Verify the targeted agent is enabled and its cron trigger is on. */
  const configSnap = await getAdminDb()
    .collection(orgAgentConfigsPath(payload.orgId))
    .doc(payload.agentName)
    .get()
  if (!configSnap.exists) {
    return Response.json({ ok: false, error: "agent_not_found" }, { status: 404 })
  }
  const cfg = agentConfigSchema.safeParse({
    ...(configSnap.data() ?? {}),
    id: payload.agentName,
    organizationId: payload.orgId,
  })
  if (!cfg.success) {
    return Response.json({ ok: false, error: "agent_malformed" }, { status: 500 })
  }
  if (!cfg.data.enabled || !cfg.data.triggers.cron) {
    return Response.json({ ok: true, skipped: true, reason: "disabled" })
  }

  /* Refuse to fire if a previous cron run for this agent is still in
   * progress - prevents pile-up if a slow run overruns its next slot. */
  const activeSnap = await getAdminDb()
    .collection(orgAgentRunsPath(payload.orgId))
    .where("agentName", "==", payload.agentName)
    .where("status", "in", ["queued", "in_progress", "awaiting_human"])
    .limit(1)
    .get()
  if (!activeSnap.empty) {
    return Response.json({
      ok: true,
      skipped: true,
      reason: "previous_run_active",
    })
  }

  const started = await startAgentRun({
    orgId: payload.orgId,
    userId: SYSTEM_USER.id,
    agentName: payload.agentName,
    input: payload.input,
    trigger: "cron",
  })
  await markAgentRunStatus({
    orgId: payload.orgId,
    runId: started.runId,
    status: "in_progress",
  })

  /* Fire the run async - we don't wait for the events.
   * `runner.runAsync()` returns an AsyncGenerator; iterating it advances
   * the agent. Errors mark the run failed. */
  void (async () => {
    let lastEvent
    try {
      for await (const ev of started.runner.runAsync({
        userId: started.userId,
        sessionId: started.sessionId,
        newMessage: started.newMessage,
      })) {
        lastEvent = ev
      }
      await markAgentRunStatus({
        orgId: payload.orgId,
        runId: started.runId,
        status: "succeeded",
      })
    } catch (err) {
      await markAgentRunStatus({
        orgId: payload.orgId,
        runId: started.runId,
        status: "failed",
        error: {
          code: "agent_error",
          message: err instanceof Error ? err.message : String(err),
        },
      })
    }
    void lastEvent
  })()

  return Response.json({
    ok: true,
    started: { runId: started.runId, sessionId: started.sessionId },
  })
}

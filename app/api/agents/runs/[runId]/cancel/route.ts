import type { NextRequest } from "next/server"

import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { markAgentRunStatus } from "@/lib/agents/triggers/manual"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/*
 * Marks a run as cancelled. The streaming routes honour request.signal
 * via the runner's abortSignal so an active in-flight stream tears down
 * naturally - this endpoint exists for paused (`awaiting_human`) runs
 * where there's no active stream to abort.
 */
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ runId: string }> },
) {
  const { runId } = await ctx.params
  const orgId = await getCurrentOrgId()
  await markAgentRunStatus({ orgId, runId, status: "cancelled" })
  return Response.json({ ok: true, id: runId })
}

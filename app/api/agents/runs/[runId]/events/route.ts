import type { NextRequest } from "next/server"

import { getAdminDb } from "@/lib/firebase/admin"
import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import {
  orgAgentRunsPath,
  orgAgentSessionEventsPath,
} from "@/lib/firebase/paths"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/* Replay an agent run's event history from Firestore. Read-only, no LLM
 * cost. Returns NDJSON (newline-delimited JSON) so the response can be
 * piped or streamed. */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ runId: string }> },
) {
  const { runId } = await ctx.params
  const orgId = await getCurrentOrgId()
  const db = getAdminDb()

  const runSnap = await db
    .collection(orgAgentRunsPath(orgId))
    .doc(runId)
    .get()
  if (!runSnap.exists) {
    return Response.json({ ok: false, error: "Run not found" }, { status: 404 })
  }
  const run = runSnap.data() as { sessionId?: string; organizationId?: string }
  if (run.organizationId !== orgId || !run.sessionId) {
    return Response.json({ ok: false, error: "Run not found" }, { status: 404 })
  }

  const eventsSnap = await db
    .collection(orgAgentSessionEventsPath(orgId, run.sessionId))
    .orderBy("seq", "asc")
    .get()

  const lines = eventsSnap.docs
    .map((d) => JSON.stringify(d.data()))
    .join("\n")

  return new Response(lines, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}

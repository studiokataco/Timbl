import type { NextRequest } from "next/server"
import { timingSafeEqual } from "node:crypto"

import { checkAllOrgsModelUpdates } from "@/lib/agents/model-update-check"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/*
 * Model-update check entrypoint (§6.8). The `modelUpdateCheck` scheduled
 * Firebase function POSTs here bi-weekly; it runs the notify-only catalog
 * diff for every org and writes modelUpdates notifications. Mirrors the
 * cron/tick route's shared-secret auth (X-Agent-Cron-Secret).
 *
 * Notify-only: this never changes an agent's model. A human reviews a
 * flagged model in Studio and swaps it themselves.
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
  const a = Buffer.from(secret ?? "", "utf8")
  const b = Buffer.from(expected, "utf8")
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const res = await checkAllOrgsModelUpdates()
    return Response.json({ ok: true, ...res })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "check_failed" },
      { status: 500 },
    )
  }
}

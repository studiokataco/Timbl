import type { NextRequest } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { z } from "zod"

import { runPublishSweepForOrg } from "@/lib/publishing/publish"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({ orgId: z.string().min(1) })

/*
 * Publish worker entrypoint. Guarded exactly like /api/agents/cron/tick:
 * X-Publish-Secret must match PUBLISH_SWEEP_SECRET (constant-time compare).
 * Sweeps the org's due scheduled posts and publishes each targeted channel.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-publish-secret")
  const expected = process.env.PUBLISH_SWEEP_SECRET
  if (!expected) {
    return Response.json(
      { ok: false, error: "PUBLISH_SWEEP_SECRET not configured" },
      { status: 503 },
    )
  }
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

  try {
    const summary = await runPublishSweepForOrg(payload.orgId)
    return Response.json({ ok: true, summary })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}

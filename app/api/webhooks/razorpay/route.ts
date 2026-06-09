import type { NextRequest } from "next/server"
import Razorpay from "razorpay"

import { getAdminDb } from "@/lib/firebase/admin"
import { platformWebhookEventDocPath } from "@/lib/platform/schema"
import { applyRazorpayEvent, type RazorpayEvent } from "@/lib/billing/webhook"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/*
 * Razorpay subscription webhook - the one inbound endpoint billing needs. It
 * cannot be a server action (external POST, no action protocol), so it lives
 * here alongside the other infra route handlers (api/publish, api/agents/cron).
 *
 * Verifies the HMAC signature, dedupes on the delivery id (process once), then
 * maps the subscription event onto org.plan + billing status. This is the SOLE
 * writer that unlocks a paid tier - createSubscription never advances the plan
 * optimistically, so a created-but-unpaid subscription grants nothing.
 *
 * Errors return 500 so Razorpay retries; the dedup marker is written only after
 * a clean apply, so a failed delivery is reprocessed rather than swallowed.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) {
    return Response.json(
      { ok: false, error: "RAZORPAY_WEBHOOK_SECRET not configured" },
      { status: 503 },
    )
  }

  const raw = await req.text()
  const signature = req.headers.get("x-razorpay-signature") ?? ""

  let valid = false
  try {
    valid = Razorpay.validateWebhookSignature(raw, signature, secret)
  } catch {
    valid = false
  }
  if (!valid) {
    return Response.json({ ok: false, error: "Invalid signature" }, { status: 401 })
  }

  let evt: RazorpayEvent
  try {
    evt = JSON.parse(raw) as RazorpayEvent
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
  }

  const db = getAdminDb()
  const eventId = req.headers.get("x-razorpay-event-id") ?? ""
  if (eventId) {
    const seen = await db.doc(platformWebhookEventDocPath(eventId)).get()
    if (seen.exists) return Response.json({ ok: true, deduped: true })
  }

  try {
    const result = await applyRazorpayEvent(evt)
    if (eventId) {
      await db.doc(platformWebhookEventDocPath(eventId)).set({
        event: evt.event ?? null,
        note: result.note,
        processedAt: new Date().toISOString(),
      })
    }
    return Response.json({ ok: true, ...result })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}

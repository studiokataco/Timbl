"use server"

import { getCurrentOrgId, getCurrentUser, getDb } from "@/lib/auth/server-helpers"
import { orgFeedbackPath } from "@/lib/firebase/paths"
import { sendFeedbackThanksEmail } from "@/lib/email/feedback"
import { writePlatformSignal } from "@/lib/platform/signals"
import { captureServerEvent } from "@/lib/telemetry/posthog-server"
import { feedbackFormSchema } from "@/lib/schemas/feedback"
import type { ServerActionResult } from "@/lib/schemas"

export async function submitFeedbackAction(raw: unknown): Promise<ServerActionResult> {
  const parsed = feedbackFormSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const orgId = await getCurrentOrgId()
  const user = await getCurrentUser()
  const db = getDb()

  const ref = db.collection(orgFeedbackPath(orgId)).doc()
  const now = new Date().toISOString()
  await ref.set({
    id: ref.id,
    organizationId: orgId,
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    message: parsed.data.message,
    category: parsed.data.category,
    createdAt: now,
  })

  void writePlatformSignal({
    kind: "feedback.submitted",
    orgId,
    summary: `Feedback from ${user.name}: ${parsed.data.message.slice(0, 120)}`,
    meta: { feedbackId: ref.id, category: parsed.data.category, email: user.email },
  }).catch(() => {})

  captureServerEvent(user.id, "feedback_submitted", {
    orgId,
    category: parsed.data.category,
    feedbackId: ref.id,
  })

  const emailResult = await sendFeedbackThanksEmail({ email: user.email, name: user.name })
  if (!emailResult.success) {
    console.warn("[feedback] thanks email failed:", emailResult.error)
  }

  return { ok: true, id: ref.id }
}

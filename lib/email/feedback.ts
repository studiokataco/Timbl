import "server-only"

import { Resend } from "resend"

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

function resolveRecipient(email: string): string {
  if (process.env.RESEND_TEST_MODE === "1" || process.env.RESEND_DEV_INBOX === "1") {
    return "delivered@resend.dev"
  }
  return email
}

function from(): string {
  if (process.env.RESEND_TEST_MODE === "1") return "Timbl <onboarding@resend.dev>"
  return process.env.RESEND_INVITE_FROM ?? "Timbl <onboarding@resend.dev>"
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export async function sendFeedbackThanksEmail(opts: {
  email: string
  name: string
}): Promise<{ success: boolean; error?: string }> {
  const resend = getResend()
  if (!resend) return { success: false, error: "Resend not configured" }

  try {
    await resend.emails.send({
      from: from(),
      to: resolveRecipient(opts.email),
      subject: "Thanks for the feedback",
      html: `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.6;color:#111;max-width:560px;margin:0 auto;padding:24px">
<p>Hi ${escapeHtml(opts.name)},</p>
<p>Thanks for taking the time to send feedback. We read every note - it shapes what we build next for Timbl.</p>
<p>If we have follow-up questions, we will reach out at this address.</p>
<p style="font-size:12px;color:#bbb;margin-top:32px">Timbl.app</p>
</body></html>`,
    })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed"
    console.warn("[email] feedback-thanks send failed:", message)
    return { success: false, error: message }
  }
}

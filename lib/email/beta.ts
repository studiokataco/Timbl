import "server-only"

import { Resend } from "resend"

import { appBaseUrl } from "@/lib/publishing/oauth"

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

export async function sendInviteAcceptedEmail(opts: {
  email: string
  name: string
}): Promise<{ success: boolean; error?: string }> {
  const resend = getResend()
  if (!resend) return { success: false, error: "Resend not configured" }

  const loginUrl = `${appBaseUrl()}/login`

  try {
    await resend.emails.send({
      from: from(),
      to: resolveRecipient(opts.email),
      subject: "You're in - welcome to Timbl",
      html: `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.6;color:#111;max-width:560px;margin:0 auto;padding:24px">
<p>Hi ${escapeHtml(opts.name)},</p>
<p>Great news - your Timbl early access request has been approved. You can now sign in and set up your workspace.</p>
<p>
  <a href="${loginUrl}" style="display:inline-block;padding:11px 20px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-weight:500">
    Sign in to Timbl
  </a>
</p>
<p style="font-size:13px;color:#666">Or open: ${loginUrl}</p>
<p style="font-size:13px;color:#999">You were approved because you requested early access. If this wasn't you, ignore this email.</p>
<p style="font-size:12px;color:#bbb;margin-top:32px">Timbl.app</p>
</body></html>`,
    })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed"
    console.warn("[email] invite-accepted send failed:", message)
    return { success: false, error: message }
  }
}

export async function sendOnboardingEmail(opts: {
  email: string
  name: string
  orgName: string
}): Promise<{ success: boolean; error?: string }> {
  const resend = getResend()
  if (!resend) return { success: false, error: "Resend not configured" }

  const calendarUrl = `${appBaseUrl()}/calendar`

  try {
    await resend.emails.send({
      from: from(),
      to: resolveRecipient(opts.email),
      subject: `Welcome to Timbl - your workspace is ready`,
      html: `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.6;color:#111;max-width:560px;margin:0 auto;padding:24px">
<p>Hi ${escapeHtml(opts.name)},</p>
<p>Your <strong>${escapeHtml(opts.orgName)}</strong> workspace is all set. Here is what to do next:</p>
<ol style="padding-left:20px;line-height:2">
  <li>Connect your social channels under <strong>Settings - channels</strong></li>
  <li>Add your first post on the <strong>Calendar</strong></li>
  <li>Let an AI agent draft a week of content for you in <strong>Studio</strong></li>
</ol>
<p>
  <a href="${calendarUrl}" style="display:inline-block;padding:11px 20px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-weight:500">
    Go to your calendar
  </a>
</p>
<p style="font-size:12px;color:#bbb;margin-top:32px">Timbl.app</p>
</body></html>`,
    })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed"
    console.warn("[email] onboarding send failed:", message)
    return { success: false, error: message }
  }
}

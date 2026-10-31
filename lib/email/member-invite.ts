import "server-only"

import { Resend } from "resend"

import { LEGAL } from "@/lib/constants/legal"
import { appBaseUrl } from "@/lib/publishing/oauth"
import type { MembershipRole } from "@/lib/auth/membership"

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

export async function sendMemberInviteEmail(opts: {
  email: string
  name: string
  role: MembershipRole
  invitedByName: string
  orgName?: string
}): Promise<{ success: boolean; error?: string }> {
  const resend = getResend()
  if (!resend) return { success: false, error: "Resend not configured" }

  const testMode = process.env.RESEND_TEST_MODE === "1"
  const from = testMode
    ? "Timbl <onboarding@resend.dev>"
    : (process.env.RESEND_INVITE_FROM ?? "Timbl <onboarding@resend.dev>")
  const loginUrl = `${appBaseUrl()}/login`
  const orgLabel = opts.orgName ?? "the workspace"

  const to = testMode || process.env.RESEND_DEV_INBOX === "1"
    ? "delivered@resend.dev"
    : opts.email

  try {
    await resend.emails.send({
      from,
      to,
      replyTo: LEGAL.contactEmail,
      subject: `You're invited to ${orgLabel}`,
      html: `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
<p>Hi ${escapeHtml(opts.name)},</p>
<p>${escapeHtml(opts.invitedByName)} invited you to join <strong>${escapeHtml(orgLabel)}</strong> as <strong>${escapeHtml(opts.role)}</strong>.</p>
<p>Sign in with Google using <strong>${escapeHtml(opts.email)}</strong>:</p>
<p><a href="${loginUrl}" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;text-decoration:none;border-radius:6px">Continue with Google</a></p>
<p style="font-size:13px;color:#666">Or open: ${loginUrl}</p>
<p style="font-size:12px;color:#999;margin-top:24px">Timbl.app</p>
</body></html>`,
    })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed"
    console.warn("[email] member invite failed:", message)
    return { success: false, error: message }
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

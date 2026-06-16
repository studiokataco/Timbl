import "server-only"

import { Resend } from "resend"

import { ROOT_PLATFORM_ADMIN_EMAIL } from "@/lib/platform/schema"
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

function controlSignupsUrl(): string {
  const adminHost = process.env.NEXT_PUBLIC_ADMIN_HOST
  if (!adminHost) return `${appBaseUrl()}/control/signups`
  const proto = adminHost.startsWith("localhost") || adminHost.startsWith("admin.localhost")
    ? "http"
    : "https"
  return `${proto}://${adminHost}/control/signups`
}

export async function sendSignupRequestedEmail(opts: {
  name: string
  email: string
  company?: string
  useCase?: string
}): Promise<{ success: boolean; error?: string }> {
  const resend = getResend()
  if (!resend) return { success: false, error: "Resend not configured" }

  const reviewUrl = controlSignupsUrl()
  const rows = [
    ["Name", opts.name],
    ["Email", opts.email],
    ...(opts.company ? [["Company", opts.company]] : []),
    ...(opts.useCase ? [["Use case", opts.useCase]] : []),
  ]
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:4px 0;color:#111">${escapeHtml(value)}</td></tr>`,
    )
    .join("")

  try {
    await resend.emails.send({
      from: from(),
      to: resolveRecipient(ROOT_PLATFORM_ADMIN_EMAIL),
      replyTo: opts.email,
      subject: `New Timbl signup request - ${opts.name}`,
      html: `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.6;color:#111;max-width:560px;margin:0 auto;padding:24px">
<p>A new early access request just landed.</p>
<table style="border-collapse:collapse;margin:8px 0 20px">${rows}</table>
<p>
  <a href="${reviewUrl}" style="display:inline-block;padding:11px 20px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-weight:500">
    Review and approve
  </a>
</p>
<p style="font-size:13px;color:#666">Or open: ${reviewUrl}</p>
<p style="font-size:12px;color:#bbb;margin-top:32px">Timbl.app</p>
</body></html>`,
    })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed"
    console.warn("[email] signup-requested send failed:", message)
    return { success: false, error: message }
  }
}

export async function sendNewWorkspaceEmail(opts: {
  name: string
  email: string
  orgName: string
}): Promise<{ success: boolean; error?: string }> {
  const resend = getResend()
  if (!resend) return { success: false, error: "Resend not configured" }

  const reviewUrl = controlSignupsUrl().replace(/\/signups$/, "/tenants")

  try {
    await resend.emails.send({
      from: from(),
      to: resolveRecipient(ROOT_PLATFORM_ADMIN_EMAIL),
      replyTo: opts.email,
      subject: `New Timbl workspace - ${opts.orgName}`,
      html: `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.6;color:#111;max-width:560px;margin:0 auto;padding:24px">
<p>A new workspace was just created via open signup.</p>
<table style="border-collapse:collapse;margin:8px 0 20px">
<tr><td style="padding:4px 12px 4px 0;color:#666;white-space:nowrap">Workspace</td><td style="padding:4px 0;color:#111">${escapeHtml(opts.orgName)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#666;white-space:nowrap">Admin</td><td style="padding:4px 0;color:#111">${escapeHtml(opts.name)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#666;white-space:nowrap">Email</td><td style="padding:4px 0;color:#111">${escapeHtml(opts.email)}</td></tr>
</table>
<p>
  <a href="${reviewUrl}" style="display:inline-block;padding:11px 20px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-weight:500">
    View tenants
  </a>
</p>
<p style="font-size:13px;color:#666">Or open: ${reviewUrl}</p>
<p style="font-size:12px;color:#bbb;margin-top:32px">Timbl.app</p>
</body></html>`,
    })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed"
    console.warn("[email] new-workspace send failed:", message)
    return { success: false, error: message }
  }
}

export async function sendInviteAcceptedEmail(opts: {
  email: string
  name: string
}): Promise<{ success: boolean; error?: string }> {
  const resend = getResend()
  if (!resend) return { success: false, error: "Resend not configured" }

  const claimUrl = `${appBaseUrl()}/claim-access?email=${encodeURIComponent(opts.email)}`

  try {
    await resend.emails.send({
      from: from(),
      to: resolveRecipient(opts.email),
      subject: "You're in - welcome to Timbl",
      html: `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.6;color:#111;max-width:560px;margin:0 auto;padding:24px">
<p>Hi ${escapeHtml(opts.name)},</p>
<p>Your Timbl early access request was approved. Before you can use your workspace, create a login with Google or a password.</p>
<p>Use <strong>${escapeHtml(opts.email)}</strong> for whichever option you pick - you will need the same method next time you sign in.</p>
<p>
  <a href="${claimUrl}" style="display:inline-block;padding:11px 20px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-weight:500">
    Create your login
  </a>
</p>
<p style="font-size:13px;color:#666">Or open: ${claimUrl}</p>
<p style="font-size:13px;color:#999">Already created your account? Sign in at ${appBaseUrl()}/login</p>
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

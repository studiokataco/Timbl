import { NextResponse, type NextRequest } from "next/server"

import { clearSessionCookie } from "@/lib/auth/session"
import { settingsRedirect } from "@/lib/publishing/oauth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  await clearSessionCookie()
  return NextResponse.json({ ok: true })
}

export async function GET(req: NextRequest) {
  await clearSessionCookie()
  // Sign-out on the admin host returns to the control-centre login, not the
  // tenant app. The CDN carries the user-facing domain in X-Forwarded-Host.
  const adminHost = process.env.NEXT_PUBLIC_ADMIN_HOST
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "")
    .split(",")[0]
    .trim()
  if (adminHost && host === adminHost) {
    const proto = host.startsWith("localhost") || host.startsWith("admin.localhost") ? "http" : "https"
    return NextResponse.redirect(`${proto}://${adminHost}/login`)
  }
  // Anchor to APP_BASE_URL, not req.url: on Cloud Run / App Hosting the request
  // URL resolves to the internal listener (http://0.0.0.0:8080), which the
  // browser can't reach ("0.0.0.0 refused to connect"). See settingsRedirect.
  return NextResponse.redirect(settingsRedirect("/login"))
}

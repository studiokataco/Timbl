import { NextResponse } from "next/server"

import { clearSessionCookie } from "@/lib/auth/session"
import { settingsRedirect } from "@/lib/publishing/oauth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  await clearSessionCookie()
  return NextResponse.json({ ok: true })
}

export async function GET() {
  await clearSessionCookie()
  // Anchor to APP_BASE_URL, not req.url: on Cloud Run / App Hosting the request
  // URL resolves to the internal listener (http://0.0.0.0:8080), which the
  // browser can't reach ("0.0.0.0 refused to connect"). See settingsRedirect.
  return NextResponse.redirect(settingsRedirect("/login"))
}

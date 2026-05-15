import { NextResponse } from "next/server"

import { clearSessionCookie } from "@/lib/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  await clearSessionCookie()
  return NextResponse.json({ ok: true })
}

export async function GET(req: Request) {
  await clearSessionCookie()
  const url = new URL("/login", req.url)
  return NextResponse.redirect(url)
}

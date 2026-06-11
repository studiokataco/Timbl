import type { NextRequest } from "next/server"
import { z } from "zod"

import { resolvePlatformClaim } from "@/lib/auth/platform-claim"
import { createSessionFromIdToken, setSessionCookie } from "@/lib/auth/session"
import { getAdminAuth } from "@/lib/firebase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({ idToken: z.string().min(20) })

/*
 * Control-centre sign-in. Reachable only on the admin host (the proxy 404s
 * /api/control/* everywhere else). Unlike /auth/callback this never
 * provisions workspaces or memberships - it admits allowlisted platform
 * admins and rejects everyone else with the same generic 403.
 */
export async function POST(req: NextRequest) {
  let payload: z.infer<typeof bodySchema>
  try {
    payload = bodySchema.parse(await req.json())
  } catch {
    return Response.json({ ok: false, error: "Invalid body" }, { status: 400 })
  }

  const auth = getAdminAuth()
  let decoded: Awaited<ReturnType<typeof auth.verifyIdToken>>
  try {
    decoded = await auth.verifyIdToken(payload.idToken, true)
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Invalid ID token" },
      { status: 401 },
    )
  }

  const email = (decoded.email ?? "").toLowerCase()
  if (!email) {
    return Response.json({ ok: false, error: "Email required." }, { status: 403 })
  }

  const platformClaim = await resolvePlatformClaim(email)
  if (platformClaim.platform !== "admin") {
    return Response.json(
      { ok: false, error: "This account does not have platform access." },
      { status: 403 },
    )
  }

  const drifted =
    decoded.platform !== platformClaim.platform ||
    decoded.platformRole !== platformClaim.platformRole
  if (drifted) {
    const user = await auth.getUser(decoded.uid)
    await auth.setCustomUserClaims(decoded.uid, {
      ...(user.customClaims ?? {}),
      ...platformClaim,
    })
    return Response.json({ ok: true, refresh: true })
  }

  try {
    const cookie = await createSessionFromIdToken(payload.idToken)
    await setSessionCookie(cookie)
    return Response.json({ ok: true, next: "/dashboard" })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Session failed" },
      { status: 401 },
    )
  }
}

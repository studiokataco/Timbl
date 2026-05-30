import type { NextRequest } from "next/server"
import { z } from "zod"

import { getAdminAuth } from "@/lib/firebase/admin"
import { authIntentSchema } from "@/lib/auth/intent-schema"
import {
  listMembershipsForEmail,
  MembershipError,
  resolveSignInMembership,
} from "@/lib/auth/membership"
import { createSessionFromIdToken, setSessionCookie } from "@/lib/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({
  idToken: z.string().min(20),
  intent: authIntentSchema.default("signin"),
})

export async function POST(req: NextRequest) {
  let payload: z.infer<typeof bodySchema>
  try {
    payload = bodySchema.parse(await req.json())
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Invalid body" },
      { status: 400 },
    )
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
    return Response.json({ ok: false, error: "Google account must include an email." }, { status: 403 })
  }

  if (payload.intent === "signup") {
    await auth.setCustomUserClaims(decoded.uid, {})
    try {
      const cookie = await createSessionFromIdToken(payload.idToken)
      await setSessionCookie(cookie)
    } catch (err) {
      return Response.json(
        { ok: false, error: err instanceof Error ? err.message : "Session failed" },
        { status: 401 },
      )
    }
    const memberships = await listMembershipsForEmail(email)
    return Response.json({
      ok: true,
      next: memberships.length > 0 ? "/workspaces" : "/workspaces?new=1",
    })
  }

  let claims: Awaited<ReturnType<typeof resolveSignInMembership>>
  try {
    claims = await resolveSignInMembership({
      email,
      displayName: decoded.name as string | undefined,
    })
  } catch (err) {
    if (err instanceof MembershipError) {
      if (err.code === "access_pending") {
        return Response.json({ ok: false, accessPending: true, error: err.message })
      }
      if (err.code === "member_inactive") {
        return Response.json({ ok: false, error: err.message }, { status: 403 })
      }
      if (err.code === "no_workspace") {
        return Response.json({ ok: false, error: err.message }, { status: 403 })
      }
    }
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Membership failed" },
      { status: 403 },
    )
  }

  const memberships = await listMembershipsForEmail(email)
  if (memberships.length > 1) {
    await auth.setCustomUserClaims(decoded.uid, {})
    try {
      const cookie = await createSessionFromIdToken(payload.idToken)
      await setSessionCookie(cookie)
    } catch (err) {
      return Response.json(
        { ok: false, error: err instanceof Error ? err.message : "Session failed" },
        { status: 401 },
      )
    }
    return Response.json({ ok: true, next: "/workspaces" })
  }

  const hasClaims =
    decoded.organizationId === claims.organizationId &&
    decoded.role === claims.role &&
    decoded.userId === claims.userId

  if (!hasClaims) {
    await auth.setCustomUserClaims(decoded.uid, claims)
    return Response.json({ ok: true, refresh: true })
  }

  try {
    const cookie = await createSessionFromIdToken(payload.idToken)
    await setSessionCookie(cookie)
    return Response.json({ ok: true, next: "/calendar" })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Session failed" },
      { status: 401 },
    )
  }
}

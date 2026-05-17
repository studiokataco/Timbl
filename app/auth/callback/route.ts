import type { NextRequest } from "next/server"
import { z } from "zod"

import { getAdminAuth } from "@/lib/firebase/admin"
import { createSessionFromIdToken, setSessionCookie } from "@/lib/auth/session"
import {
  ALLOWED_DOMAINS,
  isAllowedDomain,
  resolveOrProvisionMembership,
} from "@/lib/auth/membership"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({ idToken: z.string().min(20) })

/*
 * Two-pass sign-in:
 *
 *   Pass 1 — ID token has no membership claims yet. Verify the token,
 *   reject non-allowed domains, resolve or auto-provision the membership
 *   doc, write custom claims via Admin SDK, and return { refresh: true }.
 *
 *   Pass 2 — client refreshes its ID token (claims now present), POSTs
 *   again. We mint the session cookie from that claim-bearing token.
 *
 * The two-pass dance avoids blocking-trigger functions, which can't run
 * under the org's allowedPolicyMemberDomains constraint (allUsers is
 * forbidden as a Cloud Run invoker).
 */
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
  if (!email || !isAllowedDomain(email)) {
    return Response.json(
      {
        ok: false,
        error: `This account isn't authorised. Allowed domains: ${ALLOWED_DOMAINS.join(", ")}.`,
      },
      { status: 403 },
    )
  }

  const claims = await resolveOrProvisionMembership({
    email,
    displayName: decoded.name as string | undefined,
  })

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
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Session failed" },
      { status: 401 },
    )
  }
}

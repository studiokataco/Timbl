import type { NextRequest } from "next/server"
import { z } from "zod"

import { getAdminAuth } from "@/lib/firebase/admin"
import { createSessionFromIdToken, setSessionCookie } from "@/lib/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({ idToken: z.string().min(20) })

/** Mint a session cookie after custom claims were updated client-side. */
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
  try {
    const decoded = await auth.verifyIdToken(payload.idToken, true)
    if (!decoded.organizationId || !decoded.role || !decoded.userId) {
      return Response.json(
        { ok: false, error: "Workspace not active yet. Refresh and try again." },
        { status: 403 },
      )
    }
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

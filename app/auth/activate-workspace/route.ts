import type { NextRequest } from "next/server"
import { z } from "zod"

import { getAdminAuth } from "@/lib/firebase/admin"
import {
  getMembershipInOrg,
  provisionNewWorkspace,
} from "@/lib/auth/membership"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({
  idToken: z.string().min(20),
  organizationId: z.string().min(1).optional(),
  create: z.boolean().optional(),
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
    return Response.json({ ok: false, error: "Email required." }, { status: 403 })
  }

  let claims: Awaited<ReturnType<typeof getMembershipInOrg>>
  if (payload.create) {
    claims = await provisionNewWorkspace({
      email,
      displayName: decoded.name as string | undefined,
    })
  } else if (payload.organizationId) {
    claims = await getMembershipInOrg(email, payload.organizationId)
    if (!claims) {
      return Response.json({ ok: false, error: "You are not a member of that workspace." }, { status: 403 })
    }
  } else {
    return Response.json({ ok: false, error: "organizationId or create required." }, { status: 400 })
  }

  await auth.setCustomUserClaims(decoded.uid, claims)
  return Response.json({ ok: true, refresh: true })
}

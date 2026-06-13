import type { NextRequest } from "next/server"
import { z } from "zod"

import { readSessionClaims } from "@/lib/auth/session"
import { createAuthCode } from "@/lib/auth/oauth-tokens"
import { publicScopeSchema } from "@/lib/auth/public-scopes"
import { getAdminDb } from "@/lib/firebase/admin"
import { orgPublicAppsPath } from "@/lib/firebase/paths"
import type { PublicApp } from "@/lib/schemas/publicApp"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({
  clientId: z.string().min(1),
  redirectUri: z.string().url(),
  scopes: z.array(publicScopeSchema).min(1),
  state: z.string(),
  codeChallenge: z.string().min(43).max(128),
  codeChallengeMethod: z.literal("S256"),
})

/*
 * POST: called by the consent form when the user approves. Creates an auth
 * code and returns the redirect URI with the code + state appended.
 *
 * GET: returns the app name + scopes so the consent page can render them
 * without another server round-trip.
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get("client_id")
  const orgId = searchParams.get("org_id")
  if (!clientId || !orgId) {
    return Response.json({ error: "missing_params" }, { status: 400 })
  }

  const snap = await getAdminDb()
    .collection(orgPublicAppsPath(orgId))
    .doc(clientId)
    .get()

  if (!snap.exists) return Response.json({ error: "invalid_client" }, { status: 404 })
  const app = snap.data() as PublicApp
  if (app.revokedAt) return Response.json({ error: "invalid_client" }, { status: 401 })

  return Response.json({ name: app.name, scopes: app.scopes })
}

export async function POST(req: NextRequest) {
  const session = await readSessionClaims()
  if (!session?.workspace) {
    return Response.json({ error: "unauthenticated" }, { status: 401 })
  }

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 })
  }

  const { organizationId: orgId, userId } = session.workspace
  const db = getAdminDb()
  const appSnap = await db.collection(orgPublicAppsPath(orgId)).doc(body.clientId).get()
  if (!appSnap.exists) return Response.json({ error: "invalid_client" }, { status: 401 })

  const app = appSnap.data() as PublicApp
  if (app.revokedAt) return Response.json({ error: "invalid_client" }, { status: 401 })

  const invalidScope = body.scopes.find((s) => !app.scopes.includes(s))
  if (invalidScope) {
    return Response.json({ error: "invalid_scope", scope: invalidScope }, { status: 400 })
  }

  const code = await createAuthCode({
    appId: body.clientId,
    orgId,
    subjectUserId: userId,
    scopes: body.scopes,
    redirectUri: body.redirectUri,
    codeChallenge: body.codeChallenge,
  })

  const redirect = new URL(body.redirectUri)
  redirect.searchParams.set("code", code)
  redirect.searchParams.set("state", body.state)

  return Response.json({ redirectTo: redirect.toString() })
}

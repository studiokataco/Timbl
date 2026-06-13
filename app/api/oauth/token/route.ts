import type { NextRequest } from "next/server"
import { z } from "zod"

import { exchangeAuthCode } from "@/lib/auth/oauth-tokens"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.discriminatedUnion("grant_type", [
  z.object({
    grant_type: z.literal("authorization_code"),
    code: z.string().min(1),
    code_verifier: z.string().min(43).max(128),
    redirect_uri: z.string().url(),
    client_id: z.string().min(1),
    org_id: z.string().min(1),
  }),
])

/*
 * Token endpoint. Accepts form-encoded or JSON bodies (RFC 6749 §4.1.3).
 * For v1 only public clients (PKCE, no client_secret) are supported.
 */
export async function POST(req: NextRequest) {
  let raw: Record<string, string>
  const ct = req.headers.get("content-type") ?? ""
  if (ct.includes("application/x-www-form-urlencoded")) {
    const text = await req.text()
    raw = Object.fromEntries(new URLSearchParams(text))
  } else {
    raw = await req.json()
  }

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(raw)
  } catch {
    return tokenError("invalid_request", 400)
  }

  const result = await exchangeAuthCode({
    orgId: body.org_id,
    code: body.code,
    codeVerifier: body.code_verifier,
    redirectUri: body.redirect_uri,
  })

  if (!result) return tokenError("invalid_grant", 400)

  return Response.json(
    {
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      token_type: "Bearer",
      expires_in: result.expiresIn,
      scope: result.scopes.join(" "),
    },
    {
      headers: {
        "Cache-Control": "no-store",
        Pragma: "no-cache",
      },
    },
  )
}

function tokenError(error: string, status: number) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } })
}

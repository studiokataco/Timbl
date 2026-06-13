import type { NextRequest } from "next/server"
import { z } from "zod"

import { revokeToken } from "@/lib/auth/oauth-tokens"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({ token: z.string().min(1) })

/* Token revocation per RFC 7009. Returns 200 even for unknown tokens. */
export async function POST(req: NextRequest) {
  let raw: Record<string, string>
  const ct = req.headers.get("content-type") ?? ""
  if (ct.includes("application/x-www-form-urlencoded")) {
    raw = Object.fromEntries(new URLSearchParams(await req.text()))
  } else {
    raw = await req.json()
  }

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(raw)
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 })
  }

  await revokeToken(body.token)
  return new Response(null, { status: 200 })
}

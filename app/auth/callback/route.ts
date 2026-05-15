import type { NextRequest } from "next/server"
import { z } from "zod"

import { createSessionFromIdToken, setSessionCookie } from "@/lib/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({ idToken: z.string().min(20) })

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

  try {
    const cookie = await createSessionFromIdToken(payload.idToken)
    await setSessionCookie(cookie)
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Auth failed" },
      { status: 401 },
    )
  }
}

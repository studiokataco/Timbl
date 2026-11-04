"use server"

import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { LIVE_MODEL } from "@/lib/constants/timbl"
import type { ServerActionResult } from "@/lib/schemas"

export async function mintLiveSessionToken(): Promise<
  ServerActionResult & { token?: string; model?: string; expireTime?: string }
> {
  await getCurrentOrgId()
  const key =
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    process.env.GOOGLE_GENAI_API_KEY
  if (!key) {
    return { ok: false, error: "Voice is not configured" }
  }
  const expireTime = new Date(Date.now() + 10 * 60_000).toISOString()
  try {
    const { GoogleGenAI } = await import("@google/genai")
    const ai = new GoogleGenAI({ apiKey: key, httpOptions: { apiVersion: "v1alpha" } })
    const minted = await ai.authTokens.create({
      config: { expireTime, uses: 1 },
    })
    if (!minted.name) return { ok: false, error: "Could not mint a live token" }
    return { ok: true, token: minted.name, model: LIVE_MODEL, expireTime }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Live session failed" }
  }
}

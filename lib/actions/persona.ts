"use server"

import { z } from "zod"
import { DEFAULT_PREFS } from "@/components/agentic/defaults"
import type { PresencePrefs } from "@/components/agentic/types"
import {
  getCurrentOrgId,
  getCurrentUser,
  getDb,
} from "@/lib/auth/server-helpers"
import { orgPath, orgUsersPath } from "@/lib/firebase/paths"
import type { ServerActionResult } from "@/lib/schemas"

const saveSchema = z.object({
  assistantName: z
    .string()
    .trim()
    .min(2)
    .max(24)
    .regex(/^[\p{L}\p{M}\p{N} ]+$/u),
  reduceMotion: z.boolean(),
  largerTarget: z.boolean(),
  tips: z.boolean(),
  voiceLocale: z.enum(["en-IN", "en-GB", "en-US", "hi-IN", "hinglish"]),
  personality: z.enum(["calm", "warm", "direct", "playful"]),
  workingStyle: z.string().trim(),
  showCursors: z.boolean(),
  shortcuts: z.boolean(),
  ambient: z.object({ glow: z.boolean(), backgroundMotion: z.boolean() }),
})

export async function fetchPersona(): Promise<{
  assistantName: string
  prefs: PresencePrefs
  role: "admin" | "editor" | "contributor"
  userId: string
}> {
  const orgId = await getCurrentOrgId()
  const user = await getCurrentUser()
  const db = getDb()
  const [orgSnap, userSnap] = await Promise.all([
    db.doc(orgPath(orgId)).get(),
    db.doc(`${orgUsersPath(orgId)}/${user.id}`).get(),
  ])
  const name = orgSnap.data()?.assistantName
  const stored = userSnap.data()?.preferences?.presence as Partial<PresencePrefs> | undefined
  return {
    assistantName: typeof name === "string" && name.trim() ? name.trim() : "Timbl",
    prefs: {
      ...DEFAULT_PREFS,
      ...stored,
      ambient: { ...DEFAULT_PREFS.ambient, ...stored?.ambient },
    },
    role: user.role,
    userId: user.id,
  }
}

export async function savePersona(input: unknown): Promise<ServerActionResult> {
  const parsed = saveSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" }
  }
  const orgId = await getCurrentOrgId()
  const user = await getCurrentUser()
  const db = getDb()
  const now = new Date().toISOString()
  const { assistantName, ...prefs } = parsed.data
  await db.doc(`${orgUsersPath(orgId)}/${user.id}`).set(
    {
      preferences: { presence: prefs },
      updatedAt: now,
    },
    { merge: true },
  )
  if (user.role === "admin") {
    await db.doc(orgPath(orgId)).set({ assistantName, updatedAt: now }, { merge: true })
  }
  return { ok: true }
}

"use server"

import { z } from "zod"
import {
  getCurrentOrgId,
  getCurrentUser,
  getDb,
} from "@/lib/auth/server-helpers"
import { orgPostReadsPath, orgTeamPresencePath } from "@/lib/firebase/paths"
import type { ServerActionResult } from "@/lib/schemas"

const presenceSchema = z.object({
  sessionId: z.string().min(1).max(80),
  surface: z.literal("calendar"),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  day: z.number().int().min(0).max(6).optional(),
  hour: z.number().min(0).max(24).optional(),
  fx: z.number().min(0).max(1).optional(),
  fy: z.number().min(0).max(1).optional(),
  activity: z.enum(["idle", "editing_caption"]).default("idle"),
  postId: z.string().min(1).optional(),
})

export type TeamPresenceDoc = {
  id: string
  userId: string
  surface: "calendar"
  weekStart: string
  day?: number
  hour?: number
  fx?: number
  fy?: number
  activity: "idle" | "editing_caption"
  postId?: string
  updatedAt: string
}

export async function publishPresence(input: unknown): Promise<ServerActionResult> {
  const parsed = presenceSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" }
  }
  const orgId = await getCurrentOrgId()
  const user = await getCurrentUser()
  const { sessionId, ...rest } = parsed.data
  await getDb()
    .doc(`${orgTeamPresencePath(orgId)}/${sessionId}`)
    .set(
      {
        userId: user.id,
        ...rest,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    )
  return { ok: true }
}

export async function listPresence(): Promise<TeamPresenceDoc[]> {
  const orgId = await getCurrentOrgId()
  const user = await getCurrentUser()
  const snap = await getDb().collection(orgTeamPresencePath(orgId)).get()
  const cutoff = Date.now() - 30_000
  const out: TeamPresenceDoc[] = []
  for (const doc of snap.docs) {
    const data = doc.data()
    const updatedAt = typeof data.updatedAt === "string" ? data.updatedAt : ""
    if (Date.parse(updatedAt) < cutoff) continue
    if (data.userId === user.id) continue
    out.push({
      id: doc.id,
      userId: data.userId,
      surface: "calendar",
      weekStart: data.weekStart,
      day: data.day,
      hour: data.hour,
      fx: data.fx,
      fy: data.fy,
      activity: data.activity === "editing_caption" ? "editing_caption" : "idle",
      postId: data.postId,
      updatedAt,
    })
  }
  return out
}

export async function markPostRead(postId: string): Promise<ServerActionResult> {
  const orgId = await getCurrentOrgId()
  const user = await getCurrentUser()
  const now = new Date().toISOString()
  await getDb().doc(`${orgPostReadsPath(orgId, user.id)}/${postId}`).set(
    { lastReadAt: now, postId, userId: user.id },
    { merge: true },
  )
  return { ok: true }
}

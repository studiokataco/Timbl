"use server"

import { z } from "zod"

import { getAdminDb } from "@/lib/firebase/admin"
import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import { can } from "@/lib/auth/platform-rbac"
import { writePlatformAudit } from "@/lib/platform/audit"
import { platformConfigDocPath } from "@/lib/platform/schema"

import type { PlatformActionResult } from "./orgs"

const realtimeDefaultInput = z.object({ enabled: z.boolean() })

export type PlatformConfig = {
  realtimeDefault: boolean
}

export async function getPlatformConfig(): Promise<PlatformConfig> {
  await requirePlatformAdmin()
  const snap = await getAdminDb().doc(platformConfigDocPath).get()
  const data = snap.data() ?? {}
  if (typeof data.realtimeDefault === "boolean") {
    return { realtimeDefault: data.realtimeDefault }
  }
  return { realtimeDefault: process.env.NEXT_PUBLIC_REALTIME_DEFAULT === "1" }
}

export async function setRealtimeDefault(raw: unknown): Promise<PlatformActionResult> {
  const actor = await requirePlatformAdmin()
  if (!can(actor, "config:manage")) return { ok: false, error: "forbidden" }
  const parsed = realtimeDefaultInput.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_input" }

  const now = new Date().toISOString()
  await getAdminDb()
    .doc(platformConfigDocPath)
    .set({ realtimeDefault: parsed.data.enabled, updatedAt: now }, { merge: true })

  await writePlatformAudit({
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "config.realtime_default",
    meta: { enabled: parsed.data.enabled },
  })
  return { ok: true }
}

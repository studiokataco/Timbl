"use server"

import { z } from "zod"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgPath } from "@/lib/firebase/paths"
import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import { writePlatformAudit } from "@/lib/platform/audit"

export interface PlatformActionResult {
  ok: boolean
  error?: string
}

const input = z.object({
  orgId: z.string().min(1),
  status: z.enum(["active", "suspended"]),
})

export async function setOrgStatus(raw: unknown): Promise<PlatformActionResult> {
  const actor = await requirePlatformAdmin()
  if (actor.role !== "owner") return { ok: false, error: "forbidden" }
  const parsed = input.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { orgId, status } = parsed.data

  const ref = getAdminDb().doc(orgPath(orgId))
  if (!(await ref.get()).exists) return { ok: false, error: "org_not_found" }

  await ref.set({ status, updatedAt: new Date().toISOString() }, { merge: true })
  await writePlatformAudit({
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: status === "suspended" ? "org.suspend" : "org.reactivate",
    targetOrgId: orgId,
    meta: { status },
  })
  return { ok: true }
}

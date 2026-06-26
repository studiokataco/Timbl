"use server"

import { z } from "zod"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgPath } from "@/lib/firebase/paths"
import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import { can } from "@/lib/auth/platform-rbac"
import { writePlatformAudit } from "@/lib/platform/audit"
import { KNOWN_FEATURE_FLAGS } from "@/lib/plans/feature-flags"

import type { PlatformActionResult } from "./orgs"

const input = z.object({
  orgId: z.string().min(1),
  flag: z.enum(KNOWN_FEATURE_FLAGS),
  enabled: z.boolean(),
})

export async function setFeatureFlag(raw: unknown): Promise<PlatformActionResult> {
  const actor = await requirePlatformAdmin()
  if (!can(actor, "flags:manage")) return { ok: false, error: "forbidden" }
  const parsed = input.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { orgId, flag, enabled } = parsed.data

  const ref = getAdminDb().doc(orgPath(orgId))
  if (!(await ref.get()).exists) return { ok: false, error: "org_not_found" }

  const now = new Date().toISOString()
  await ref.set(
    { featureFlags: { [flag]: enabled }, updatedAt: now },
    { merge: true },
  )
  await writePlatformAudit({
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "feature_flag.set",
    targetOrgId: orgId,
    meta: { flag, enabled },
  })
  return { ok: true }
}

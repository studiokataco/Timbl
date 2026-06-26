"use server"

import { z } from "zod"
import { FieldValue } from "firebase-admin/firestore"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgPath } from "@/lib/firebase/paths"
import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import { can } from "@/lib/auth/platform-rbac"
import { writePlatformAudit } from "@/lib/platform/audit"

import type { PlatformActionResult } from "./orgs"

/* value: a number caps the metric; null = unlimited; "clear" removes the
 * override so the metric falls back to the plan default. */
const input = z.object({
  orgId: z.string().min(1),
  metric: z.enum(["agentRuns", "scheduledPosts", "brands", "seats"]),
  value: z.union([z.number().int().nonnegative(), z.null(), z.literal("clear")]),
})

export async function setOrgQuotaOverride(
  raw: unknown,
): Promise<PlatformActionResult> {
  const actor = await requirePlatformAdmin()
  if (!can(actor, "quotas:manage")) return { ok: false, error: "forbidden" }
  const parsed = input.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { orgId, metric, value } = parsed.data

  const ref = getAdminDb().doc(orgPath(orgId))
  if (!(await ref.get()).exists) return { ok: false, error: "org_not_found" }

  /* Nested object so set(merge) touches only this metric, never the whole
   * overrides map. A "quotaOverrides.key" string would be written as a literal
   * flat field instead of nesting. "clear" must use FieldValue.delete() - the
   * Admin DB has ignoreUndefinedProperties set, so undefined would be a no-op. */
  await ref.set(
    {
      quotaOverrides: {
        [metric]: value === "clear" ? FieldValue.delete() : value,
      },
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  )
  await writePlatformAudit({
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "quota.override",
    targetOrgId: orgId,
    meta: { metric, value: value === "clear" ? "cleared" : value },
  })
  return { ok: true }
}

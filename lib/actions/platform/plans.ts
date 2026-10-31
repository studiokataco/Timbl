"use server"

import { z } from "zod"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgPath } from "@/lib/firebase/paths"
import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import { can } from "@/lib/auth/platform-rbac"
import { writePlatformAudit } from "@/lib/platform/audit"
import { PLANS } from "@/lib/plans/plans"

import type { PlatformActionResult } from "./orgs"

const input = z.object({
  orgId: z.string().min(1),
  planId: z.string().refine((id) => id in PLANS, "unknown_plan"),
})

export async function setOrgPlan(raw: unknown): Promise<PlatformActionResult> {
  const actor = await requirePlatformAdmin()
  if (!can(actor, "plans:manage")) return { ok: false, error: "forbidden" }
  const parsed = input.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { orgId, planId } = parsed.data

  const ref = getAdminDb().doc(orgPath(orgId))
  const snap = await ref.get()
  if (!snap.exists) return { ok: false, error: "org_not_found" }
  const from = (snap.data()?.plan as string | undefined) ?? null
  const endsTrial = snap.data()?.billingStatus === "trialing"

  await ref.set(
    {
      plan: planId,
      ...(endsTrial ? { billingStatus: "manual" } : {}),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  )
  await writePlatformAudit({
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "plan.change",
    targetOrgId: orgId,
    meta: { from, to: planId },
  })
  return { ok: true }
}

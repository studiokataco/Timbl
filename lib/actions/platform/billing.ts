"use server"

import { getAdminDb } from "@/lib/firebase/admin"
import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import { can } from "@/lib/auth/platform-rbac"
import { writePlatformAudit } from "@/lib/platform/audit"
import { platformBillingDocPath } from "@/lib/platform/schema"
import {
  billingProfileSchema,
  DEFAULT_BILLING_PROFILE,
  type BillingProfile,
} from "@/lib/schemas/billing"

import type { PlatformActionResult } from "./orgs"

/* Per-tenant billing profile lives under /platform (locked to platform
 * admins by firestore.rules), not under the org - it's company-use payment
 * data, never tenant-visible. */

export async function getBillingProfile(orgId: string): Promise<BillingProfile> {
  await requirePlatformAdmin()
  const snap = await getAdminDb().doc(platformBillingDocPath(orgId)).get()
  if (!snap.exists) return DEFAULT_BILLING_PROFILE
  const parsed = billingProfileSchema.safeParse(snap.data())
  return parsed.success ? parsed.data : DEFAULT_BILLING_PROFILE
}

export async function setBillingProfile(
  orgId: string,
  raw: unknown,
): Promise<PlatformActionResult> {
  const actor = await requirePlatformAdmin()
  if (!can(actor, "billing:manage")) return { ok: false, error: "forbidden" }
  const parsed = billingProfileSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_input" }

  await getAdminDb()
    .doc(platformBillingDocPath(orgId))
    .set({ ...parsed.data, updatedAt: new Date().toISOString() }, { merge: true })

  await writePlatformAudit({
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "billing.update",
    targetOrgId: orgId,
    meta: { status: parsed.data.status },
  })
  return { ok: true }
}

"use server"

import { FieldValue } from "firebase-admin/firestore"
import { z } from "zod"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgPath } from "@/lib/firebase/paths"
import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import { writePlatformAudit } from "@/lib/platform/audit"
import {
  platformBillingDocPath,
  platformOrgRollupDocPath,
} from "@/lib/platform/schema"

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

  const now = new Date().toISOString()
  await ref.set(
    status === "suspended"
      ? { status, suspendedAt: now, updatedAt: now }
      : { status, suspendedAt: FieldValue.delete(), updatedAt: now },
    { merge: true },
  )
  await writePlatformAudit({
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: status === "suspended" ? "org.suspend" : "org.reactivate",
    targetOrgId: orgId,
    meta: { status },
  })
  return { ok: true }
}

const deleteInput = z.object({
  orgId: z.string().min(1),
  /* Type-to-confirm from the UI - must equal the org id exactly. */
  confirm: z.string().min(1),
})

/*
 * Permanent workspace deletion. Only reachable for orgs already suspended -
 * suspension is the soft stage (reversible, 60-day retention before the
 * orgRetentionSweep function hard-deletes), this is the hard stage. Wipes
 * the org tree, its platform rollups, and its billing profile. The audit
 * row is written BEFORE the wipe so the action is on record even if the
 * recursive delete partially fails.
 */
export async function deleteOrganization(
  raw: unknown,
): Promise<PlatformActionResult> {
  const actor = await requirePlatformAdmin()
  if (actor.role !== "owner") return { ok: false, error: "forbidden" }
  const parsed = deleteInput.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { orgId, confirm } = parsed.data
  if (confirm !== orgId) return { ok: false, error: "confirm_mismatch" }

  const db = getAdminDb()
  const snap = await db.doc(orgPath(orgId)).get()
  if (!snap.exists) return { ok: false, error: "org_not_found" }
  const data = snap.data() ?? {}
  if (data.status !== "suspended") return { ok: false, error: "not_suspended" }

  await writePlatformAudit({
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "org.delete",
    targetOrgId: orgId,
    meta: {
      name: (data.name as string) ?? orgId,
      suspendedAt: (data.suspendedAt as string) ?? null,
    },
  })
  await db.recursiveDelete(db.doc(orgPath(orgId)))
  await db.recursiveDelete(db.doc(platformOrgRollupDocPath(orgId)))
  await db.doc(platformBillingDocPath(orgId)).delete()
  return { ok: true }
}

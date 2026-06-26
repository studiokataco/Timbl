"use server"

import { randomUUID } from "node:crypto"
import { z } from "zod"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgPath, orgUsersPath } from "@/lib/firebase/paths"
import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import { can } from "@/lib/auth/platform-rbac"
import {
  clearImpersonationCookie,
  loadImpersonationRecord,
  readImpersonationId,
  setImpersonationCookie,
} from "@/lib/auth/impersonation"
import { writePlatformAudit } from "@/lib/platform/audit"
import { platformImpersonationDocPath } from "@/lib/platform/schema"

import type { PlatformActionResult } from "./orgs"

const THIRTY_MIN_MS = 30 * 60 * 1000

/* Pick a user to impersonate: prefer an admin, else any member. */
async function resolveTargetUser(
  orgId: string,
): Promise<{ userId: string; role: "admin" | "editor" | "contributor" } | null> {
  const col = getAdminDb().collection(orgUsersPath(orgId))
  const adminSnap = await col.where("role", "==", "admin").limit(1).get()
  const doc = adminSnap.docs[0] ?? (await col.limit(1).get()).docs[0]
  if (!doc) return null
  const role = (doc.data().role as "admin" | "editor" | "contributor") ?? "admin"
  return { userId: doc.id, role }
}

const startInput = z.object({ orgId: z.string().min(1) })

export async function startImpersonation(raw: unknown): Promise<PlatformActionResult> {
  const actor = await requirePlatformAdmin()
  if (!can(actor, "impersonation:start")) return { ok: false, error: "forbidden" }
  const parsed = startInput.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { orgId } = parsed.data

  if (!(await getAdminDb().doc(orgPath(orgId)).get()).exists) {
    return { ok: false, error: "org_not_found" }
  }
  const target = await resolveTargetUser(orgId)
  if (!target) return { ok: false, error: "no_user_to_impersonate" }

  const id = randomUUID()
  const now = new Date()
  await getAdminDb()
    .doc(platformImpersonationDocPath(id))
    .set({
      id,
      adminUid: actor.uid,
      adminEmail: actor.email,
      orgId,
      userId: target.userId,
      role: target.role,
      /* Full-access in v1: impersonation grants the target role's writes
       * too. Read-only mode is a planned hardening (a write-guard across the
       * mutation surface) - not claimed until enforced. */
      readOnly: false,
      revoked: false,
      expiresAt: new Date(now.getTime() + THIRTY_MIN_MS).toISOString(),
      createdAt: now.toISOString(),
    })
  await setImpersonationCookie(id)
  await writePlatformAudit({
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "impersonation.start",
    targetOrgId: orgId,
    target: { type: "user", id: target.userId },
    meta: { sessionId: id, role: target.role },
  })
  return { ok: true }
}

export async function endImpersonation(): Promise<PlatformActionResult> {
  const id = await readImpersonationId()
  await clearImpersonationCookie()
  if (!id) return { ok: true }

  const rec = await loadImpersonationRecord(id)
  await getAdminDb()
    .doc(platformImpersonationDocPath(id))
    .set({ revoked: true, endedAt: new Date().toISOString() }, { merge: true })

  /* Best-effort audit. The actor is the impersonating admin recorded on the
   * session; if the cookie is stale we still clear and return ok. */
  if (rec) {
    await writePlatformAudit({
      actorUid: rec.adminUid,
      actorEmail: rec.adminEmail,
      action: "impersonation.end",
      targetOrgId: rec.orgId,
      target: { type: "user", id: rec.userId },
      meta: { sessionId: id },
    })
  }
  return { ok: true }
}

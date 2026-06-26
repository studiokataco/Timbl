"use server"

import { z } from "zod"

import { syncClaimsForEmail } from "@/lib/actions/members"
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin"
import { orgPath, orgUsersPath } from "@/lib/firebase/paths"
import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import { can } from "@/lib/auth/platform-rbac"
import {
  findMembership,
  listMembershipsForEmail,
  normalizeEmail,
  slugify,
  type MembershipRole,
} from "@/lib/auth/membership"
import { writePlatformAudit } from "@/lib/platform/audit"
import {
  platformAuditEntrySchema,
  platformAuditLogPath,
  type PlatformAuditEntry,
} from "@/lib/platform/schema"

import type { PlatformActionResult } from "./orgs"

const emailInput = z.object({ email: z.string().email() })

const assignInput = z.object({
  email: z.string().email(),
  orgId: z.string().min(1),
  role: z.enum(["admin", "editor", "contributor"]).default("contributor"),
  name: z.string().min(1).max(120).optional(),
})

export type PlatformUserLookup = {
  email: string
  authUid: string | null
  claims: Record<string, unknown> | null
  memberships: Array<{
    organizationId: string
    orgName: string
    userId: string
    role: MembershipRole
    active: boolean
  }>
}

export async function lookupPlatformUser(raw: unknown): Promise<
  PlatformActionResult & { user?: PlatformUserLookup }
> {
  await requirePlatformAdmin()
  const parsed = emailInput.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_email" }
  const email = normalizeEmail(parsed.data.email)

  const memberships = await listMembershipsForEmail(email)
  const db = getAdminDb()
  const enriched = await Promise.all(
    memberships.map(async (m) => {
      const orgSnap = await db.doc(orgPath(m.organizationId)).get()
      const userSnap = await db.doc(`${orgUsersPath(m.organizationId)}/${m.userId}`).get()
      const userData = userSnap.data() ?? {}
      return {
        organizationId: m.organizationId,
        orgName: (orgSnap.data()?.name as string) ?? m.organizationId,
        userId: m.userId,
        role: m.role,
        active: userData.active !== false,
      }
    }),
  )

  let authUid: string | null = null
  let claims: Record<string, unknown> | null = null
  try {
    const authUser = await getAdminAuth().getUserByEmail(email)
    authUid = authUser.uid
    claims = (authUser.customClaims as Record<string, unknown>) ?? {}
  } catch {
    /* no auth user yet */
  }

  return {
    ok: true,
    user: { email, authUid, claims, memberships: enriched },
  }
}

export async function remintPlatformUserClaims(raw: unknown): Promise<PlatformActionResult> {
  const actor = await requirePlatformAdmin()
  if (!can(actor, "users:manage")) return { ok: false, error: "forbidden" }
  const parsed = emailInput.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_email" }
  const email = normalizeEmail(parsed.data.email)

  const membership = await findMembership(email)
  if (!membership || membership.active === false) {
    return { ok: false, error: "no_active_membership" }
  }

  await syncClaimsForEmail(email)

  await writePlatformAudit({
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "user.claims_remint",
    targetOrgId: membership.organizationId,
    target: { type: "user", id: email },
  })
  return { ok: true }
}

export async function assignPlatformMembership(raw: unknown): Promise<PlatformActionResult> {
  const actor = await requirePlatformAdmin()
  if (!can(actor, "users:manage")) return { ok: false, error: "forbidden" }
  const parsed = assignInput.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { orgId, role } = parsed.data
  const email = normalizeEmail(parsed.data.email)
  const name = parsed.data.name?.trim() || email.split("@")[0]

  const orgRef = getAdminDb().doc(orgPath(orgId))
  if (!(await orgRef.get()).exists) return { ok: false, error: "org_not_found" }

  const userId = slugify(email.split("@")[0])
  const now = new Date().toISOString()
  await getAdminDb()
    .doc(`${orgUsersPath(orgId)}/${userId}`)
    .set(
      {
        id: userId,
        email,
        name,
        role,
        organizationId: orgId,
        active: true,
        provisionedAt: now,
        provisionedVia: "platform_admin",
      },
      { merge: true },
    )

  await syncClaimsForEmail(email)

  await writePlatformAudit({
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "user.membership_assign",
    targetOrgId: orgId,
    target: { type: "user", id: email, label: name },
    meta: { role },
  })
  return { ok: true }
}

export async function getUserPlatformAudit(email: string): Promise<PlatformAuditEntry[]> {
  await requirePlatformAdmin()
  const norm = normalizeEmail(email)
  const snap = await getAdminDb()
    .collection(platformAuditLogPath)
    .orderBy("createdAt", "desc")
    .limit(100)
    .get()
  const out: PlatformAuditEntry[] = []
  for (const d of snap.docs) {
    const parsed = platformAuditEntrySchema.safeParse({ ...d.data(), id: d.id })
    if (!parsed.success) continue
    const row = parsed.data
    if (row.target?.id === norm || row.meta?.email === norm) out.push(row)
    if (out.length >= 10) break
  }
  return out
}

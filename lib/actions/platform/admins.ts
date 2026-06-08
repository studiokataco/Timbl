"use server"

import { z } from "zod"

import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin"
import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import { writePlatformAudit } from "@/lib/platform/audit"
import {
  emailSlug,
  platformAdminDocPath,
  platformAdminsPath,
  platformAdminSchema,
  platformRole as platformRoleSchema,
  ROOT_PLATFORM_ADMIN_EMAIL,
  type PlatformAdmin,
} from "@/lib/platform/schema"

import type { PlatformActionResult } from "./orgs"

/*
 * Platform-team management. The root admin (hello@kataco.in) grants and
 * revokes additional platform admins - the people who manage clients on our
 * behalf. There is no self-service path; only an existing platform admin
 * reaches these actions (requirePlatformAdmin).
 *
 * Each grant writes the allowlist doc (re-stamped into claims on next
 * sign-in by the blocking trigger) AND, if the target already has an auth
 * account, stamps the claim immediately so no re-login is needed.
 */

const grantInput = z.object({
  email: z.string().email(),
  role: platformRoleSchema.default("analyst"),
})
const emailInput = z.object({ email: z.string().email() })

export async function listPlatformAdmins(): Promise<
  Array<PlatformAdmin & { slug: string }>
> {
  await requirePlatformAdmin()
  const snap = await getAdminDb().collection(platformAdminsPath).get()
  const out: Array<PlatformAdmin & { slug: string }> = []
  for (const d of snap.docs) {
    const parsed = platformAdminSchema.safeParse(d.data())
    if (parsed.success) out.push({ ...parsed.data, slug: d.id })
  }
  return out.sort((a, b) => a.email.localeCompare(b.email))
}

export async function grantPlatformAdmin(raw: unknown): Promise<PlatformActionResult> {
  const actor = await requirePlatformAdmin()
  if (actor.role !== "owner") return { ok: false, error: "forbidden" }
  const parsed = grantInput.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const email = parsed.data.email.toLowerCase()
  const role = parsed.data.role
  const slug = emailSlug(email)

  await getAdminDb()
    .doc(platformAdminDocPath(slug))
    .set(
      { email, role, grantedBy: actor.email, grantedAt: new Date().toISOString() },
      { merge: true },
    )

  /* Stamp the claim immediately if the user exists; otherwise the blocking
   * trigger picks it up on first sign-in. */
  try {
    const user = await getAdminAuth().getUserByEmail(email)
    await getAdminAuth().setCustomUserClaims(user.uid, {
      ...(user.customClaims ?? {}),
      platform: "admin",
      platformRole: role,
    })
  } catch {
    /* no auth user yet - allowlist doc is enough */
  }

  await writePlatformAudit({
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "admin.grant",
    target: { type: "platformAdmin", id: email },
    meta: { role },
  })
  return { ok: true }
}

export async function revokePlatformAdmin(raw: unknown): Promise<PlatformActionResult> {
  const actor = await requirePlatformAdmin()
  if (actor.role !== "owner") return { ok: false, error: "forbidden" }
  const parsed = emailInput.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_email" }
  const email = parsed.data.email.toLowerCase()

  if (email === ROOT_PLATFORM_ADMIN_EMAIL) {
    return { ok: false, error: "cannot_revoke_root_admin" }
  }
  const slug = emailSlug(email)

  await getAdminDb().doc(platformAdminDocPath(slug)).delete()
  try {
    const user = await getAdminAuth().getUserByEmail(email)
    const claims = { ...(user.customClaims ?? {}) }
    delete (claims as Record<string, unknown>).platform
    delete (claims as Record<string, unknown>).platformRole
    await getAdminAuth().setCustomUserClaims(user.uid, claims)
  } catch {
    /* no auth user - nothing to unstamp */
  }

  await writePlatformAudit({
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "admin.revoke",
    target: { type: "platformAdmin", id: email },
  })
  return { ok: true }
}

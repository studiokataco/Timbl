"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import {
  getCurrentOrgId,
  getCurrentOrganisation,
  getDb,
  requireRole,
} from "@/lib/auth/server-helpers"
import { sendMemberInviteEmail } from "@/lib/email/member-invite"
import {
  findMembership,
  normalizeEmail,
  slugify,
  type MembershipRole,
} from "@/lib/auth/membership"
import { resolvePlatformClaim } from "@/lib/auth/platform-claim"
import { getAdminAuth } from "@/lib/firebase/admin"
import {
  orgAccessRequestsPath,
  orgInvitesPath,
  orgUsersPath,
} from "@/lib/firebase/paths"
import { snapToData, type WithId } from "@/lib/firebase/serialize"
import { writeAuditEvent } from "@/lib/telemetry/audit-events"
import { userRole, type ServerActionResult, type User } from "@/lib/schemas"

const inviteInput = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  role: userRole,
})

const emailInput = z.object({ email: z.string().email() })

const accessInput = z.object({
  uid: z.string().min(1),
  role: userRole,
})

const memberPatchInput = z.object({
  userId: z.string().min(1),
  role: userRole.optional(),
  active: z.boolean().optional(),
})

export type OrgInvite = {
  id: string
  email: string
  name: string
  role: MembershipRole
  invitedAt: string
  invitedByName?: string
}

export type OrgAccessRequest = {
  id: string
  uid: string
  email: string
  displayName: string
  photoURL: string | null
  requestedAt: string
}

export async function listOrgMembers(): Promise<WithId<User>[]> {
  await requireRole(["admin"])
  const orgId = await getCurrentOrgId()
  const snap = await getDb().collection(orgUsersPath(orgId)).get()
  return snap.docs
    .map((d) => snapToData<User>(d))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function listOrgInvites(): Promise<OrgInvite[]> {
  await requireRole(["admin"])
  const orgId = await getCurrentOrgId()
  const snap = await getDb().collection(orgInvitesPath(orgId)).get()
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      email: data.email as string,
      name: data.name as string,
      role: data.role as MembershipRole,
      invitedAt: data.invitedAt as string,
      invitedByName: data.invitedByName as string | undefined,
    }
  })
}

export async function listAccessRequests(): Promise<OrgAccessRequest[]> {
  await requireRole(["admin"])
  const orgId = await getCurrentOrgId()
  const snap = await getDb()
    .collection(orgAccessRequestsPath(orgId))
    .where("status", "==", "pending")
    .get()
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      uid: data.uid as string,
      email: data.email as string,
      displayName: data.displayName as string,
      photoURL: (data.photoURL as string | null) ?? null,
      requestedAt: data.requestedAt as string,
    }
  })
}

export type MemberInviteResult = ServerActionResult & {
  emailSent?: boolean
  emailError?: string
}

export async function createMemberInvite(input: unknown): Promise<MemberInviteResult> {
  const actor = await requireRole(["admin"])
  const parsed = inviteInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" }
  }
  const orgId = await getCurrentOrgId()
  const email = normalizeEmail(parsed.data.email)
  const existing = await findMembership(email)
  if (existing) {
    return { ok: false, error: "User is already a workspace member" }
  }
  const now = new Date().toISOString()
  await getDb()
    .doc(`${orgInvitesPath(orgId)}/${email}`)
    .set({
      email,
      name: parsed.data.name.trim(),
      role: parsed.data.role,
      organizationId: orgId,
      invitedAt: now,
      invitedBy: actor.id,
      invitedByName: actor.name,
    })
  await writeAuditEvent({
    orgId,
    kind: "member.add",
    actorUserId: actor.id,
    target: { type: "invite", id: email, label: email },
    meta: { role: parsed.data.role },
  })
  const org = await getCurrentOrganisation()
  const emailResult = await sendMemberInviteEmail({
    email,
    name: parsed.data.name.trim(),
    role: parsed.data.role,
    invitedByName: actor.name,
    orgName: org.name,
  })
  revalidatePath("/settings/team")
  return {
    ok: true,
    id: email,
    emailSent: emailResult.success,
    emailError: emailResult.error,
  }
}

export async function revokeMemberInvite(input: unknown): Promise<ServerActionResult> {
  const actor = await requireRole(["admin"])
  const parsed = emailInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" }
  }
  const orgId = await getCurrentOrgId()
  const email = normalizeEmail(parsed.data.email)
  await getDb().doc(`${orgInvitesPath(orgId)}/${email}`).delete()
  await writeAuditEvent({
    orgId,
    kind: "member.remove",
    actorUserId: actor.id,
    target: { type: "invite", id: email, label: email },
  })
  revalidatePath("/settings/team")
  return { ok: true }
}

export async function approveAccessRequest(input: unknown): Promise<ServerActionResult> {
  const actor = await requireRole(["admin"])
  const parsed = accessInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" }
  }
  const orgId = await getCurrentOrgId()
  const reqRef = getDb().doc(`${orgAccessRequestsPath(orgId)}/${parsed.data.uid}`)
  const reqSnap = await reqRef.get()
  if (!reqSnap.exists) {
    return { ok: false, error: "Request not found" }
  }
  const req = reqSnap.data()!
  const email = normalizeEmail(req.email as string)
  const userId = slugify(email.split("@")[0])
  const now = new Date().toISOString()
  const batch = getDb().batch()
  batch.set(getDb().doc(`${orgUsersPath(orgId)}/${userId}`), {
    id: userId,
    organizationId: orgId,
    email,
    name: req.displayName as string,
    role: parsed.data.role,
    active: true,
    googleUid: parsed.data.uid,
    createdAt: now,
    updatedAt: now,
    provisionedVia: "access-request",
  })
  batch.delete(reqRef)
  await batch.commit()
  await syncClaimsForEmail(email)
  await writeAuditEvent({
    orgId,
    kind: "member.add",
    actorUserId: actor.id,
    target: { type: "user", id: userId, label: email },
    meta: { role: parsed.data.role, via: "access-request" },
  })
  revalidatePath("/settings/team")
  return { ok: true, id: userId }
}

export async function denyAccessRequest(input: unknown): Promise<ServerActionResult> {
  await requireRole(["admin"])
  const parsed = z.object({ uid: z.string().min(1) }).safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" }
  }
  const orgId = await getCurrentOrgId()
  await getDb().doc(`${orgAccessRequestsPath(orgId)}/${parsed.data.uid}`).delete()
  revalidatePath("/settings/team")
  return { ok: true }
}

export async function updateOrgMember(input: unknown): Promise<ServerActionResult> {
  const actor = await requireRole(["admin"])
  const parsed = memberPatchInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" }
  }
  const orgId = await getCurrentOrgId()
  const ref = getDb().doc(`${orgUsersPath(orgId)}/${parsed.data.userId}`)
  const snap = await ref.get()
  if (!snap.exists) return { ok: false, error: "Member not found" }
  const before = snap.data() as User
  if (before.id === actor.id && parsed.data.active === false) {
    return { ok: false, error: "You cannot deactivate your own account" }
  }
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  if (parsed.data.role !== undefined) patch.role = parsed.data.role
  if (parsed.data.active !== undefined) patch.active = parsed.data.active
  await ref.set(patch, { merge: true })
  await syncClaimsForEmail(before.email)
  await writeAuditEvent({
    orgId,
    kind: "member.update",
    actorUserId: actor.id,
    target: { type: "user", id: parsed.data.userId, label: before.email },
    meta: patch,
  })
  revalidatePath("/settings/team")
  return { ok: true, id: parsed.data.userId }
}

export async function syncClaimsForEmail(email: string) {
  const membership = await findMembership(email)
  if (!membership || membership.active === false) return
  try {
    const authUser = await getAdminAuth().getUserByEmail(email)
    const platformClaim = await resolvePlatformClaim(email)
    await getAdminAuth().setCustomUserClaims(authUser.uid, {
      organizationId: membership.organizationId,
      role: membership.role,
      userId: membership.userId,
      ...platformClaim,
    })
  } catch {
    /* Auth user may not exist until first Google sign-in. */
  }
}

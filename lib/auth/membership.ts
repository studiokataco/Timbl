import "server-only"
import { FieldValue } from "firebase-admin/firestore"

import { getAdminDb } from "@/lib/firebase/admin"
import {
  orgAccessRequestsPath,
  orgInvitesPath,
  orgUsersPath,
} from "@/lib/firebase/paths"

export const SAFE_ORG_ID = "safe-foundation"
export const ALLOWED_DOMAINS = ["safefoundation.org.uk", "kataco.in"] as const

export type MembershipRole = "admin" | "editor" | "contributor"

export type MembershipClaims = {
  organizationId: string
  role: MembershipRole
  userId: string
}

export class MembershipError extends Error {
  constructor(
    readonly code: "domain_not_allowed" | "access_pending" | "member_inactive",
    message?: string,
  ) {
    super(message ?? code)
    this.name = "MembershipError"
  }
}

export function isAllowedDomain(email: string): boolean {
  const domain = email.toLowerCase().split("@")[1]
  return Boolean(domain) && (ALLOWED_DOMAINS as readonly string[]).includes(domain)
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export async function resolveOrProvisionMembership(opts: {
  email: string
  displayName?: string
  googleUid?: string
  photoURL?: string | null
}): Promise<MembershipClaims> {
  const email = normalizeEmail(opts.email)
  const existing = await findMembership(email)
  if (existing) {
    if (existing.active === false) {
      throw new MembershipError("member_inactive", "Your account is deactivated.")
    }
    return {
      organizationId: existing.organizationId,
      role: existing.role,
      userId: existing.userId,
    }
  }

  const fromInvite = await claimInvite(email, opts.displayName ?? email.split("@")[0])
  if (fromInvite) return fromInvite

  if (!isAllowedDomain(email)) {
    throw new MembershipError(
      "domain_not_allowed",
      `This account isn't authorised. Allowed domains: ${ALLOWED_DOMAINS.join(", ")}.`,
    )
  }

  await recordAccessRequest({
    email,
    googleUid: opts.googleUid,
    displayName: opts.displayName ?? email.split("@")[0],
    photoURL: opts.photoURL,
  })
  throw new MembershipError(
    "access_pending",
    "Your sign-in is waiting for admin approval.",
  )
}

type MembershipRow = MembershipClaims & { active: boolean }

export async function findMembership(email: string): Promise<MembershipRow | null> {
  const db = getAdminDb()
  const norm = normalizeEmail(email)
  const orgs = await db.collection("organizations").get()
  for (const org of orgs.docs) {
    const hit = await db
      .collection(orgUsersPath(org.id))
      .where("email", "==", norm)
      .limit(1)
      .get()
    if (!hit.empty) {
      const doc = hit.docs[0]
      const data = doc.data()
      return {
        organizationId: org.id,
        userId: doc.id,
        role: (data.role as MembershipRole) ?? "contributor",
        active: data.active !== false,
      }
    }
  }
  return null
}

async function claimInvite(
  email: string,
  displayName: string,
): Promise<MembershipClaims | null> {
  const db = getAdminDb()
  const orgs = await db.collection("organizations").get()
  for (const org of orgs.docs) {
    const ref = db.doc(`${orgInvitesPath(org.id)}/${email}`)
    const snap = await ref.get()
    if (!snap.exists) continue
    const data = snap.data() ?? {}
    const role = (data.role as MembershipRole) ?? "contributor"
    const name = (data.name as string) ?? displayName
    const userId = slugify(email.split("@")[0])
    await db
      .doc(`${orgUsersPath(org.id)}/${userId}`)
      .set(
        {
          id: userId,
          email,
          name,
          role,
          organizationId: org.id,
          active: true,
          provisionedAt: FieldValue.serverTimestamp(),
          provisionedVia: "invite",
        },
        { merge: true },
      )
    await ref.delete()
    return { organizationId: org.id, role, userId }
  }
  return null
}

async function recordAccessRequest(opts: {
  email: string
  googleUid?: string
  displayName: string
  photoURL?: string | null
}) {
  if (!opts.googleUid) return
  const db = getAdminDb()
  const ref = db.doc(`${orgAccessRequestsPath(SAFE_ORG_ID)}/${opts.googleUid}`)
  const existing = await ref.get()
  if (existing.exists) return
  await ref.set({
    id: opts.googleUid,
    organizationId: SAFE_ORG_ID,
    uid: opts.googleUid,
    email: opts.email,
    displayName: opts.displayName,
    photoURL: opts.photoURL ?? null,
    status: "pending",
    requestedAt: new Date().toISOString(),
    authProvider: "google",
  })
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60)
}

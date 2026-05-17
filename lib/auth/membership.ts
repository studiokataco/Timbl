import "server-only"
import { FieldValue } from "firebase-admin/firestore"

import { getAdminDb } from "@/lib/firebase/admin"

export const SAFE_ORG_ID = "safe-foundation"
export const ALLOWED_DOMAINS = ["safefoundation.org.uk", "kataco.in"] as const

export type MembershipRole = "admin" | "editor" | "contributor"

export type MembershipClaims = {
  organizationId: string
  role: MembershipRole
  userId: string
}

export function isAllowedDomain(email: string): boolean {
  const domain = email.toLowerCase().split("@")[1]
  return Boolean(domain) && (ALLOWED_DOMAINS as readonly string[]).includes(domain)
}

/*
 * Resolve membership for the signed-in email. If no membership exists yet
 * but the email belongs to an allowed Workspace domain, auto-provision a
 * contributor doc under SAFE so future server reads find them.
 */
export async function resolveOrProvisionMembership(opts: {
  email: string
  displayName?: string
}): Promise<MembershipClaims> {
  const email = opts.email.toLowerCase()
  const existing = await findMembership(email)
  if (existing) return existing

  if (!isAllowedDomain(email)) {
    throw new Error("domain_not_allowed")
  }

  return provisionContributor(email, opts.displayName ?? email.split("@")[0])
}

async function findMembership(email: string): Promise<MembershipClaims | null> {
  const db = getAdminDb()
  const orgs = await db.collection("organizations").get()
  for (const org of orgs.docs) {
    const hit = await db
      .collection(`organizations/${org.id}/users`)
      .where("email", "==", email)
      .limit(1)
      .get()
    if (!hit.empty) {
      const doc = hit.docs[0]
      const data = doc.data()
      return {
        organizationId: org.id,
        userId: doc.id,
        role: (data.role as MembershipRole) ?? "contributor",
      }
    }
  }
  return null
}

async function provisionContributor(
  email: string,
  displayName: string,
): Promise<MembershipClaims> {
  const db = getAdminDb()
  const slug = slugify(email.split("@")[0])
  const ref = db.collection(`organizations/${SAFE_ORG_ID}/users`).doc(slug)
  await ref.set(
    {
      email,
      name: displayName,
      role: "contributor",
      organizationId: SAFE_ORG_ID,
      provisionedAt: FieldValue.serverTimestamp(),
      provisionedVia: "auth-callback",
    },
    { merge: true },
  )
  return { organizationId: SAFE_ORG_ID, role: "contributor", userId: slug }
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60)
}

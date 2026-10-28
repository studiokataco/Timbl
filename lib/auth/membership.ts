import "server-only"
import { FieldValue } from "firebase-admin/firestore"

import { getAdminDb } from "@/lib/firebase/admin"
import {
  orgInvitesPath,
  orgPath,
  orgUsersPath,
} from "@/lib/firebase/paths"
import { sendNewWorkspaceEmail } from "@/lib/email/beta"
import { bootstrapNewOrg } from "@/lib/org/bootstrap"
import { recordActivationMilestone } from "@/lib/telemetry/activation"
import { identifyServerGroup } from "@/lib/telemetry/posthog-server"
import {
  defaultOrgNameForNewWorkspace,
  isConsumerEmailDomain,
  LEGACY_DOMAIN_TO_ORG,
  orgIdForNewWorkspace,
  slugify,
} from "@/lib/auth/domains"
import type { AuthIntent } from "@/lib/auth/intent"

export type { AuthIntent }

export const ALLOWED_DOMAINS = ["safefoundation.org.uk", "kataco.in"] as const
export type MembershipRole = "admin" | "editor" | "contributor"

export type MembershipClaims = {
  organizationId: string
  role: MembershipRole
  userId: string
}

export class MembershipError extends Error {
  constructor(
    readonly code:
      | "domain_not_allowed"
      | "access_pending"
      | "member_inactive"
      | "no_workspace"
      | "signup_disabled",
    message?: string,
  ) {
    super(message ?? code)
    this.name = "MembershipError"
  }
}

export { slugify }

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export type WorkspaceOption = MembershipClaims & {
  name: string
}

export async function listMembershipsForEmail(email: string): Promise<WorkspaceOption[]> {
  const db = getAdminDb()
  const norm = normalizeEmail(email)
  const orgs = await db.collection("organizations").get()
  const out: WorkspaceOption[] = []
  for (const org of orgs.docs) {
    const hit = await db
      .collection(orgUsersPath(org.id))
      .where("email", "==", norm)
      .limit(1)
      .get()
    if (hit.empty) continue
    const doc = hit.docs[0]
    const data = doc.data()
    if (data.active === false) continue
    const orgData = org.data()
    out.push({
      organizationId: org.id,
      userId: doc.id,
      role: (data.role as MembershipRole) ?? "contributor",
      name: (orgData.name as string) ?? org.id,
    })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

export async function resolveAuthMembership(
  intent: AuthIntent,
  opts: {
    email: string
    displayName?: string
    googleUid?: string
    photoURL?: string | null
  },
): Promise<MembershipClaims> {
  if (intent === "signup") {
    throw new MembershipError(
      "domain_not_allowed",
      "Signup only creates your account. Pick a workspace next.",
    )
  }
  return resolveSignInMembership(opts)
}

/** @deprecated Use resolveAuthMembership("signin", opts) */
export async function resolveOrProvisionMembership(opts: {
  email: string
  displayName?: string
  googleUid?: string
  photoURL?: string | null
}): Promise<MembershipClaims> {
  return resolveAuthMembership("signin", opts)
}

export async function resolveSignInMembership(opts: {
  email: string
  displayName?: string
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

  const domain = email.split("@")[1]
  const legacy = domain ? LEGACY_DOMAIN_TO_ORG[domain] : undefined
  if (legacy) {
    return provisionOrgMember({
      orgId: legacy.orgId,
      email,
      displayName: opts.displayName ?? email.split("@")[0],
      role: legacy.role,
      via: "legacy-domain",
    })
  }

  throw new MembershipError(
    "no_workspace",
    "No workspace found for this account. Sign up and create a workspace, or ask for an invite.",
  )
}

export async function provisionNewWorkspace(opts: {
  email: string
  displayName?: string
  /* Name the user typed in the create-workspace step. Required by the app
   * signup UI; falls back to a derived default for any caller that omits it
   * (e.g. first member of a business domain). */
  workspaceName?: string
}): Promise<MembershipClaims> {
  if (process.env.NEW_ORG_SIGNUP === "off") {
    throw new MembershipError(
      "signup_disabled",
      "New workspace signup is disabled. Ask an admin for an invite.",
    )
  }

  const email = normalizeEmail(opts.email)

  const domain = email.split("@")[1]
  if (!domain) {
    throw new MembershipError("domain_not_allowed", "A valid email domain is required.")
  }

  const chosenName = opts.workspaceName?.trim()
  const orgName = chosenName || defaultOrgNameForNewWorkspace(email, opts.displayName)

  const consumer = isConsumerEmailDomain(domain)
  const orgId = orgIdForNewWorkspace(email)
  const db = getAdminDb()
  const orgRef = db.doc(orgPath(orgId))
  const orgSnap = await orgRef.get()

  if (consumer) {
    if (orgSnap.exists) {
      throw new MembershipError(
        "domain_not_allowed",
        "Could not create workspace. Please try again.",
      )
    }
    await bootstrapNewOrg({ orgId, name: orgName })
    const claims = await provisionOrgMember({
      orgId,
      email,
      displayName: opts.displayName ?? email.split("@")[0],
      role: "admin",
      via: "signup",
    })
    await sendNewWorkspaceEmail({ name: opts.displayName ?? email, email, orgName })
    identifyServerGroup("organization", orgId, { name: orgName })
    await recordActivationMilestone(orgId, "signed_up", claims.userId, { via: "self_serve" })
    return claims
  }

  const createdNewOrg = !orgSnap.exists
  if (createdNewOrg) {
    await bootstrapNewOrg({ orgId, name: orgName })
  }

  const hasMembers = !(await orgRef.collection("users").limit(1).get()).empty
  const role: MembershipRole = hasMembers ? "contributor" : "admin"

  const claims = await provisionOrgMember({
    orgId,
    email,
    displayName: opts.displayName ?? email.split("@")[0],
    role,
    via: "signup",
  })
  if (createdNewOrg) {
    await sendNewWorkspaceEmail({ name: opts.displayName ?? email, email, orgName })
    identifyServerGroup("organization", orgId, { name: orgName })
    await recordActivationMilestone(orgId, "signed_up", claims.userId, { via: "self_serve" })
  }
  return claims
}

async function provisionOrgMember(opts: {
  orgId: string
  email: string
  displayName: string
  role: MembershipRole
  via: string
}): Promise<MembershipClaims> {
  const userId = slugify(opts.email.split("@")[0])
  await getAdminDb()
    .doc(`${orgUsersPath(opts.orgId)}/${userId}`)
    .set(
      {
        id: userId,
        email: opts.email,
        name: opts.displayName,
        role: opts.role,
        organizationId: opts.orgId,
        active: true,
        provisionedAt: FieldValue.serverTimestamp(),
        provisionedVia: opts.via,
      },
      { merge: true },
    )
  return { organizationId: opts.orgId, role: opts.role, userId }
}

type MembershipRow = MembershipClaims & { active: boolean }

export async function getMembershipInOrg(
  email: string,
  organizationId: string,
): Promise<MembershipClaims | null> {
  const row = await findMembership(email)
  if (!row || row.organizationId !== organizationId || row.active === false) return null
  return {
    organizationId: row.organizationId,
    role: row.role,
    userId: row.userId,
  }
}

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
    const claims = await provisionOrgMember({
      orgId: org.id,
      email,
      displayName: name,
      role,
      via: "invite",
    })
    await ref.delete()
    return claims
  }
  return null
}

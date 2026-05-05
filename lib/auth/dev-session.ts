/*
 * Development auth shim. Returns a SAFE Foundation admin for every request.
 *
 * This is the ONLY source of "who is logged in" until Phase 7. Server actions,
 * page loaders, and queries all read identity through getCurrentUser() and
 * getCurrentOrgId() so the Phase 7 swap to real Firebase Auth is a one-file
 * change with no callsite churn.
 *
 * The IDs are deterministic — Phase 1's seed script writes a SAFE org doc
 * at /organizations/safe-foundation and an admin user at
 * /organizations/safe-foundation/users/admin.
 */

export type DevUser = {
  id: string
  email: string
  name: string
  role: "admin" | "editor" | "contributor"
}

export type DevOrganisation = {
  id: string
  slug: string
  name: string
}

export const DEV_SESSION: { user: DevUser; organisation: DevOrganisation } = {
  user: {
    id: "admin",
    email: "admin@safefoundation.dev",
    name: "SAFE Admin",
    role: "admin",
  },
  organisation: {
    id: "safe-foundation",
    slug: "safe-foundation",
    name: "SAFE Foundation",
  },
}

export function getCurrentUser(): DevUser {
  return DEV_SESSION.user
}

export function getCurrentOrgId(): string {
  return DEV_SESSION.organisation.id
}

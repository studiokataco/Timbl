/*
 * Development auth shim. Returns a SAFE Foundation admin for every request
 * — but ONLY when NEXT_PUBLIC_USE_EMULATORS=1 (set by `pnpm dev`). In any
 * other environment this module's identity is meaningless; server-helpers
 * routes through `lib/auth/session.ts` instead.
 *
 * The shim IDs are deterministic — Phase 1's seed script writes a SAFE org
 * doc at /organizations/safe-foundation and an admin user at
 * /organizations/safe-foundation/users/admin.
 */

export const IS_DEV_SHIM = process.env.NEXT_PUBLIC_USE_EMULATORS === "1"

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
  if (!IS_DEV_SHIM) {
    throw new Error(
      "dev-session.getCurrentUser called outside emulator mode. Use lib/auth/server-helpers#getCurrentUser instead.",
    )
  }
  return DEV_SESSION.user
}

export function getCurrentOrgId(): string {
  if (!IS_DEV_SHIM) {
    throw new Error(
      "dev-session.getCurrentOrgId called outside emulator mode. Use lib/auth/server-helpers#getCurrentOrgId instead.",
    )
  }
  return DEV_SESSION.organisation.id
}

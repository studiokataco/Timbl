/*
 * Development auth shim. Returns a demo workspace identity for every
 * request - but ONLY when NEXT_PUBLIC_USE_EMULATORS=1 (set by `pnpm dev`).
 * In any other environment this module's identity is meaningless;
 * server-helpers routes through `lib/auth/session.ts` instead.
 *
 * Two dev orgs exist, and the shim can resolve to either one:
 *
 *   - "demo"   → SAFE Foundation (`safe-foundation`). Fully seeded by
 *                firestore/seeds/0001-0009 - categories, agents, awareness
 *                days. This is the showcase org for demos.
 *   - "tenant" → "Your workspace" (`tenant-workspace`). Seeded near-empty
 *                by firestore/seeds/0010 so the onboarding wizard is the
 *                only thing that fills it. This is the default.
 *
 * Which one is active is pinned by the DEV_ORG_COOKIE, written by the
 * Settings → Workspace "SAFE demo mode" toggle (lib/actions/dev-org.ts)
 * and read by server-helpers. The seed scripts write the matching org +
 * admin-user docs for both.
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

export type DevSession = {
  user: DevUser
  organisation: DevOrganisation
}

/* "demo" = SAFE showcase org · "tenant" = your wizard-built workspace. */
export type DevOrgMode = "demo" | "tenant"

/* Cookie that pins the active dev org. Read by server-helpers on every
 * request; written by the Settings → Workspace toggle. */
export const DEV_ORG_COOKIE = "safe_dev_org"

/* Unchecked "SAFE demo mode" = your own workspace. A fresh tenant org has
 * no onboarding.completedAt, so first boot lands on the wizard. */
export const DEFAULT_DEV_ORG_MODE: DevOrgMode = "tenant"

const DEMO_SESSION: DevSession = {
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

const TENANT_SESSION: DevSession = {
  user: {
    id: "admin",
    email: "owner@yourworkspace.dev",
    name: "Workspace owner",
    role: "admin",
  },
  organisation: {
    id: "tenant-workspace",
    slug: "tenant-workspace",
    name: "Your workspace",
  },
}

export const DEV_SESSIONS: Record<DevOrgMode, DevSession> = {
  demo: DEMO_SESSION,
  tenant: TENANT_SESSION,
}

/** Back-compat alias - the SAFE demo session. Prefer DEV_SESSIONS[mode]. */
export const DEV_SESSION = DEMO_SESSION

/** Coerce a raw cookie value to a valid mode, falling back to the default. */
export function normalizeDevOrgMode(raw: string | undefined | null): DevOrgMode {
  return raw === "demo" || raw === "tenant" ? raw : DEFAULT_DEV_ORG_MODE
}

export function getDevSession(mode: DevOrgMode): DevSession {
  return DEV_SESSIONS[mode]
}

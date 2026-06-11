import {
  DEV_ORG_COOKIE,
  TIMBL_DEMO_ORG_ID,
  TIMBL_DEV_ADMIN_EMAIL,
} from "@/lib/constants/timbl"

export { DEV_ORG_COOKIE }

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

export type DevOrgMode = "demo" | "tenant"

export const DEFAULT_DEV_ORG_MODE: DevOrgMode = "tenant"

const DEMO_SESSION: DevSession = {
  user: {
    id: "admin",
    email: TIMBL_DEV_ADMIN_EMAIL,
    name: "Timbl Admin",
    role: "admin",
  },
  organisation: {
    id: TIMBL_DEMO_ORG_ID,
    slug: TIMBL_DEMO_ORG_ID,
    name: "Timbl demo",
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

export const DEV_SESSION = DEMO_SESSION

export function normalizeDevOrgMode(raw: string | undefined | null): DevOrgMode {
  return raw === "demo" || raw === "tenant" ? raw : DEFAULT_DEV_ORG_MODE
}

export function getDevSession(mode: DevOrgMode): DevSession {
  return DEV_SESSIONS[mode]
}

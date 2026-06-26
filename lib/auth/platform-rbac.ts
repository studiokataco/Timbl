export const PLATFORM_ROLES = ["owner", "admin", "support"] as const
export type PlatformRole = (typeof PLATFORM_ROLES)[number]

export const PLATFORM_CAPABILITIES = [
  "team:manage",
  "config:manage",
  "tenants:status",
  "tenants:manage",
  "tenants:delete",
  "plans:manage",
  "quotas:manage",
  "billing:manage",
  "trials:manage",
  "flags:manage",
  "agents:operate",
  "users:manage",
  "signups:review",
  "impersonation:start",
] as const
export type PlatformCapability = (typeof PLATFORM_CAPABILITIES)[number]

/* Owner-only levers: the two irreversible powers - deciding who is an admin,
 * and hard-deleting a tenant. */
const OWNER_ONLY: readonly PlatformCapability[] = ["team:manage", "tenants:delete"]

/* Support is the customer-facing floor: low-risk, reversible operations. */
const SUPPORT_CAPABILITIES: readonly PlatformCapability[] = [
  "tenants:status",
  "signups:review",
  "impersonation:start",
]

const ROLE_CAPABILITIES: Record<PlatformRole, ReadonlySet<PlatformCapability>> = {
  owner: new Set(PLATFORM_CAPABILITIES),
  admin: new Set(PLATFORM_CAPABILITIES.filter((c) => !OWNER_ONLY.includes(c))),
  support: new Set(SUPPORT_CAPABILITIES),
}

export function can(
  actor: { role: PlatformRole },
  capability: PlatformCapability,
): boolean {
  return ROLE_CAPABILITIES[actor.role]?.has(capability) ?? false
}

export interface RoleMeta {
  label: string
  description: string
  tone: string
}

export const ROLE_META: Record<PlatformRole, RoleMeta> = {
  owner: {
    label: "Owner",
    description: "Full access. Manages the team and can delete tenants.",
    tone: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  },
  admin: {
    label: "Admin",
    description:
      "Runs every tenant operation - plans, quotas, billing, agents, users. Cannot manage the team or delete tenants.",
    tone: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  },
  support: {
    label: "Support",
    description:
      "Reviews signups, impersonates users, and suspends or reactivates tenants. Read-only everywhere else.",
    tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
}

export function coercePlatformRole(raw: unknown): PlatformRole {
  if (raw === "owner" || raw === "admin" || raw === "support") return raw
  if (raw == null) return "owner"
  return "support"
}

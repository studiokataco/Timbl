import "server-only"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgPath } from "@/lib/firebase/paths"
import { readBrand } from "@/lib/brand/brand-store"
import { resolveOrgChannels } from "@/lib/channels"
import type { ChannelKey } from "@/lib/schemas"
import {
  getCurrentOrgId,
  getCurrentUser,
} from "@/lib/auth/server-helpers"
import { listMembershipsForEmail, type MembershipRole } from "@/lib/auth/membership"
import { getPlan, type PlanTier } from "@/lib/plans/plans"
import {
  IS_DEV_SHIM,
  DEV_SESSIONS,
  type DevOrgMode,
} from "@/lib/auth/dev-session"

export type WorkspaceSummary = {
  id: string
  name: string
  role: MembershipRole
  tier: PlanTier
  channels: ChannelKey[]
  current: boolean
  logoUrl?: string
  color?: string
  /* Only set under the emulator shim - which dev cookie value activates it. */
  devMode?: DevOrgMode
}

export type WorkspaceSwitcherData = {
  current: WorkspaceSummary
  workspaces: WorkspaceSummary[]
  canCreateWorkspace: boolean
  isDevShim: boolean
}

async function resolveChannelsForOrg(orgId: string): Promise<ChannelKey[]> {
  const [brand, orgSnap] = await Promise.all([
    readBrand(orgId),
    getAdminDb().doc(orgPath(orgId)).get(),
  ])

  const brandChannels =
    brand && brand.channels.length ? brand.channels : undefined

  const onboardingChannels = orgSnap.data()?.onboarding?.profile?.channels as
    | string[]
    | undefined

  return resolveOrgChannels({ brandChannels, onboardingChannels })
}

async function resolveOrgIdentity(orgId: string) {
  const data = (await getAdminDb().doc(orgPath(orgId)).get()).data() ?? {}
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined)
  return {
    tier: getPlan(data.plan as string | undefined).tier as PlanTier,
    name: str(data.name),
    logoUrl: str(data.logoUrl),
    color: str(data.primaryColor),
  }
}

async function summarise(
  base: { id: string; name: string; role: MembershipRole; devMode?: DevOrgMode },
  currentOrgId: string,
): Promise<WorkspaceSummary> {
  const [channels, identity] = await Promise.all([
    resolveChannelsForOrg(base.id),
    resolveOrgIdentity(base.id),
  ])
  return {
    id: base.id,
    name: identity.name ?? base.name,
    role: base.role,
    tier: identity.tier,
    channels,
    current: base.id === currentOrgId,
    logoUrl: identity.logoUrl,
    color: identity.color,
  }
}

/*
 * View model for the sidebar workspace switcher. Lists every workspace the
 * current user belongs to (their memberships), each with the connected
 * channels and plan tier the dropdown renders. Under the emulator shim the
 * two dev sessions (demo / tenant) stand in for real memberships, since
 * switching there flips a cookie rather than re-minting a session.
 */
export async function getWorkspaceSwitcherData(): Promise<WorkspaceSwitcherData> {
  const [user, currentOrgId] = await Promise.all([
    getCurrentUser(),
    getCurrentOrgId(),
  ])

  if (IS_DEV_SHIM) {
    const modes = Object.keys(DEV_SESSIONS) as DevOrgMode[]
    const workspaces = await Promise.all(
      modes.map(async (mode) => {
        const s = DEV_SESSIONS[mode]
        const summary = await summarise(
          { id: s.organisation.id, name: s.organisation.name, role: s.user.role },
          currentOrgId,
        )
        return { ...summary, devMode: mode }
      }),
    )
    workspaces.sort((a, b) => a.name.localeCompare(b.name))
    const current = workspaces.find((w) => w.current) ?? workspaces[0]
    return { current, workspaces, canCreateWorkspace: true, isDevShim: true }
  }

  const memberships = await listMembershipsForEmail(user.email)
  const known = memberships.some((m) => m.organizationId === currentOrgId)
  const rows = known
    ? memberships
    : [
        ...memberships,
        {
          organizationId: currentOrgId,
          name: currentOrgId,
          role: user.role as MembershipRole,
          userId: user.id,
        },
      ]

  const workspaces = await Promise.all(
    rows.map((m) =>
      summarise(
        { id: m.organizationId, name: m.name, role: m.role },
        currentOrgId,
      ),
    ),
  )
  workspaces.sort((a, b) => a.name.localeCompare(b.name))
  const current =
    workspaces.find((w) => w.current) ?? workspaces[0]

  return {
    current,
    workspaces,
    canCreateWorkspace: process.env.NEW_ORG_SIGNUP !== "off",
    isDevShim: false,
  }
}

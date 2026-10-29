import "server-only"

import { cache } from "react"

import {
  getCurrentOrganisation,
  getCurrentOrgId,
  getCurrentUser,
  getDb,
} from "@/lib/auth/server-helpers"
import { orgPath, orgUsersPath } from "@/lib/firebase/paths"
import { getOrgPlan } from "@/lib/plans/gate"

const PLAN_LABELS = { free: "Free", studio: "Studio", agency: "Agency", scale: "Scale" } as const

export type UserProfile = {
  id: string
  email: string
  role: "admin" | "editor" | "contributor"
  name: string
  avatarUrl?: string
}

export type WorkspaceIdentity = {
  id: string
  name: string
  logoUrl?: string
  color?: string
  planLabel: string
}

export const getCurrentUserProfile = cache(async (): Promise<UserProfile> => {
  const [user, orgId] = await Promise.all([getCurrentUser(), getCurrentOrgId()])
  const snap = await getDb().doc(`${orgUsersPath(orgId)}/${user.id}`).get()
  const data = snap.data() ?? {}
  const name = typeof data.name === "string" && data.name.trim() ? data.name.trim() : user.name
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name,
    avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : undefined,
  }
})

export const getCurrentWorkspaceIdentity = cache(async (): Promise<WorkspaceIdentity> => {
  const org = await getCurrentOrganisation()
  const [snap, plan] = await Promise.all([getDb().doc(orgPath(org.id)).get(), getOrgPlan(org.id)])
  const data = snap.data() ?? {}
  return {
    id: org.id,
    name: org.name,
    logoUrl: typeof data.logoUrl === "string" ? data.logoUrl : undefined,
    color: typeof data.primaryColor === "string" ? data.primaryColor : undefined,
    planLabel: `${PLAN_LABELS[plan.tier]} plan`,
  }
})

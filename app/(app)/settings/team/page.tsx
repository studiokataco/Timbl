export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"

import { TeamManager } from "@/components/settings/team-manager"
import {
  listAccessRequests,
  listOrgInvites,
  listOrgMembers,
} from "@/lib/actions/members"
import { getCurrentUser } from "@/lib/auth/server-helpers"

export default async function SettingsTeamPage() {
  const user = await getCurrentUser()
  if (user.role !== "admin") redirect("/settings")

  const [members, invites, requests] = await Promise.all([
    listOrgMembers(),
    listOrgInvites(),
    listAccessRequests(),
  ])

  return (
    <TeamManager
      members={members}
      invites={invites}
      requests={requests}
      currentUserId={user.id}
    />
  )
}

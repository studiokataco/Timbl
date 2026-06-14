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
    <div className="px-4 sm:px-6 py-4 flex-1">
      <TeamManager members={members} invites={invites} requests={requests} />
    </div>
  )
}

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
      <div className="mb-4">
        <h1 className="text-lg font-medium">Team</h1>
        <p className="text-xs text-muted-foreground">
          Invite people, approve new sign-ins, and manage member roles.
        </p>
      </div>
      <TeamManager members={members} invites={invites} requests={requests} />
    </div>
  )
}

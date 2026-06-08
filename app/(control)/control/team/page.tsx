import { PageHeading } from "@/components/control/widgets"
import { TeamManager } from "@/components/control/team-manager"
import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import { listPlatformAdmins } from "@/lib/actions/platform/admins"

export const dynamic = "force-dynamic"

export default async function TeamPage() {
  const [actor, admins] = await Promise.all([
    requirePlatformAdmin(),
    listPlatformAdmins(),
  ])

  return (
    <div>
      <PageHeading
        title="Team"
        description="Platform admins who can access the control centre. Owners manage tenants and the team; analysts monitor read-only."
      />
      <TeamManager
        admins={admins.map((a) => ({
          email: a.email,
          role: a.role,
          grantedBy: a.grantedBy,
          grantedAt: a.grantedAt,
        }))}
        canManage={actor.role === "owner"}
      />
    </div>
  )
}

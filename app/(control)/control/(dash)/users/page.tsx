import { UserOpsPanel } from "@/components/control/user-ops"
import { PageHeading, StatItem, StatStrip } from "@/components/control/widgets"
import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import { listPlatformUsers } from "@/lib/platform/queries"

export const dynamic = "force-dynamic"

export default async function ControlUsersPage() {
  await requirePlatformAdmin()
  const users = await listPlatformUsers()

  const multiOrg = users.filter((u) => u.orgCount > 1).length
  const inactive = users.filter((u) => u.activeOrgCount === 0).length

  return (
    <div>
      <PageHeading
        title="Users"
        description="Every person across all workspaces. Select one to inspect claims and memberships, or re-mint tokens after a repair."
      />

      <StatStrip className="mb-8 grid-cols-3">
        <StatItem label="Users" value={String(users.length)} />
        <StatItem label="In multiple workspaces" value={String(multiOrg)} />
        <StatItem
          label="No active membership"
          value={String(inactive)}
          tone={inactive > 0 ? "negative" : undefined}
        />
      </StatStrip>

      <UserOpsPanel users={users} />
    </div>
  )
}

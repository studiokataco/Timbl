import { UserOpsPanel } from "@/components/control/user-ops"
import { PageHeading } from "@/components/control/widgets"
import { requirePlatformAdmin } from "@/lib/auth/platform-guard"

export const dynamic = "force-dynamic"

export default async function ControlUsersPage() {
  await requirePlatformAdmin()
  return (
    <div>
      <PageHeading
        title="Users"
        description="Look up a user by email, inspect claims and memberships, and re-mint tokens after repairs."
      />
      <UserOpsPanel />
    </div>
  )
}

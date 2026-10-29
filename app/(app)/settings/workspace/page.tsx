export const dynamic = "force-dynamic"

import { SettingsPage } from "@/components/settings/settings-page"
import { WorkspaceSettings } from "@/components/settings/workspace-settings"
import { getDevOrgMode } from "@/lib/actions/dev-org"
import { IS_DEV_SHIM } from "@/lib/auth/dev-session"
import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { getCurrentUserProfile, getCurrentWorkspaceIdentity } from "@/lib/identity/profile.server"
import { getOnboardingState } from "@/lib/onboarding/state"

export default async function SettingsWorkspacePage() {
  const orgId = await getCurrentOrgId()
  const [state, devOrgMode, workspace, profile] = await Promise.all([
    getOnboardingState(orgId),
    getDevOrgMode(),
    getCurrentWorkspaceIdentity(),
    getCurrentUserProfile(),
  ])

  return (
    <SettingsPage
      title="Workspace"
      description={`${workspace.name} is shared by everyone on your team. Brands, members and billing all live here.`}
    >
      <WorkspaceSettings
        workspace={workspace}
        canEdit={profile.role === "admin"}
        completedAt={state.completedAt}
        industry={state.profile?.industry}
        devShim={IS_DEV_SHIM}
        devOrgMode={devOrgMode}
      />
    </SettingsPage>
  )
}

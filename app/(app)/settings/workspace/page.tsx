export const dynamic = "force-dynamic"

import { WorkspaceSettings } from "@/components/settings/workspace-settings"
import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { getOnboardingState } from "@/lib/onboarding/state"

export default async function SettingsWorkspacePage() {
  const orgId = await getCurrentOrgId()
  const state = await getOnboardingState(orgId)
  return (
    <div className="px-4 sm:px-6 py-4 flex-1">
      <div className="mb-4">
        <h1 className="text-lg font-medium">Workspace</h1>
        <p className="text-xs text-muted-foreground">
          Re-run the setup wizard or update your workspace profile.
        </p>
      </div>
      <WorkspaceSettings
        completedAt={state.completedAt}
        industry={state.profile?.industry}
      />
    </div>
  )
}

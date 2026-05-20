export const dynamic = "force-dynamic"

import { WorkspaceSettings } from "@/components/settings/workspace-settings"
import { getDevOrgMode } from "@/lib/actions/dev-org"
import { IS_DEV_SHIM } from "@/lib/auth/dev-session"
import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { getOnboardingState } from "@/lib/onboarding/state"

export default async function SettingsWorkspacePage() {
  const orgId = await getCurrentOrgId()
  const [state, devOrgMode] = await Promise.all([
    getOnboardingState(orgId),
    getDevOrgMode(),
  ])
  return (
    <div className="px-4 sm:px-6 py-4 flex-1">
      <div className="mb-4">
        <h1 className="text-lg font-medium">Workspace</h1>
        <p className="text-xs text-muted-foreground">
          Re-run the setup wizard or switch between workspaces.
        </p>
      </div>
      <WorkspaceSettings
        completedAt={state.completedAt}
        industry={state.profile?.industry}
        devShim={IS_DEV_SHIM}
        devOrgMode={devOrgMode}
      />
    </div>
  )
}

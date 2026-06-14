export const dynamic = "force-dynamic"

import { WorkspaceSettings } from "@/components/settings/workspace-settings"
import { SettingsSection } from "@/components/settings/settings-section"
import { getDevOrgMode } from "@/lib/actions/dev-org"
import { IS_DEV_SHIM } from "@/lib/auth/dev-session"
import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { getOnboardingState } from "@/lib/onboarding/state"

import { BrandWizardClient } from "./brand-client"

export default async function SettingsWorkspacePage() {
  const orgId = await getCurrentOrgId()
  const [state, devOrgMode] = await Promise.all([
    getOnboardingState(orgId),
    getDevOrgMode(),
  ])

  return (
    <div className="px-4 sm:px-6 pt-4 pb-24 flex-1">
      <SettingsSection
        title="Setup"
        description="Re-run the onboarding wizard, replay the product tour, or switch workspaces."
        isFirst
      >
        <WorkspaceSettings
          completedAt={state.completedAt}
          industry={state.profile?.industry}
          devShim={IS_DEV_SHIM}
          devOrgMode={devOrgMode}
        />
      </SettingsSection>

      <SettingsSection
        title="Brand"
        description="Teach the AI your brand voice, audience, channels, and posting cadence."
      >
        <BrandWizardClient />
      </SettingsSection>
    </div>
  )
}

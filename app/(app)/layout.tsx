import { redirect } from "next/navigation"

import { AgentCommandModal } from "@/components/agents/agent-command-modal"
import { AgentDrawer } from "@/components/agents/agent-drawer"
import { AskAiButton } from "@/components/agents/ask-ai-button"
import { AppHotkeys } from "@/components/shared/app-hotkeys"
import { CommandPalette } from "@/components/shared/command-palette"
import { DialogsProvider } from "@/components/shared/dialogs-provider"
import { DunningBanner } from "@/components/shared/dunning-banner"
import { Onboarding } from "@/components/shared/onboarding"
import { ProductTourAutostart } from "@/components/tour/product-tour"
import { PlanFeaturesProvider } from "@/components/shared/plan-features-provider"
import { QueryProvider } from "@/components/shared/query-provider"
import { ShortcutsDialog } from "@/components/shared/shortcuts-dialog"
import { Sidebar } from "@/components/shared/sidebar"
import { TopBar } from "@/components/shared/top-bar"
import { WorkspaceProvider } from "@/components/shared/workspace-provider"
import { WorkspaceReminders } from "@/components/shared/workspace-reminders"
import { ImpersonationBanner } from "@/components/control/impersonation-banner"
import { RealtimeDegradedProvider } from "@/lib/realtime/degraded-state"
import { fetchReferenceData } from "@/lib/queries/reference-data.server"
import { resolveImpersonation } from "@/lib/auth/impersonation"
import {
  getCurrentOrgId,
  getCurrentOrganisation,
  getCurrentUser,
  requireActiveOrg,
} from "@/lib/auth/server-helpers"
import { isOnboardingComplete } from "@/lib/onboarding/state"
import { getOrgPlanFeatures } from "@/lib/plans/gate"
import { getWorkspaceSwitcherData } from "@/lib/queries/workspaces.server"
import { getBrandSwitcherData } from "@/lib/queries/brands.server"

export const metadata = { robots: { index: false, follow: false } }

/*
 * (app) tree shares one QueryClient + sidebar nav + global ⌘K palette + the
 * global DialogsProvider that mounts QuickAddDialog and PostComposerSheet
 * once for the whole app. The TopBar is mounted here once so every (app)
 * route renders identical chrome (Ask AI, Search, Quick add) without leaf
 * pages having to remember to import it. Reference data (categories /
 * users / ctas / campaigns / kanban columns / hashtag suggestions) is
 * fetched here and shared via context so any page can open Quick add /
 * composer in place.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const orgId = await getCurrentOrgId()
  /* Suspended orgs (set from the control centre) can't use the app. */
  await requireActiveOrg(orgId)
  /* First-launch redirect: orgs that never completed the wizard land on
   * /onboarding. /onboarding lives outside this layout group, so the
   * redirect cannot loop. The (onboarding) layout owns its own chrome. */
  if (!(await isOnboardingComplete(orgId))) {
    redirect("/onboarding")
  }
  const [referenceData, user, org, planFeatures, impersonation, workspaces, brands] = await Promise.all([
    fetchReferenceData(),
    getCurrentUser(),
    getCurrentOrganisation(),
    getOrgPlanFeatures(orgId),
    resolveImpersonation(),
    getWorkspaceSwitcherData(),
    getBrandSwitcherData(),
  ])
  return (
    <QueryProvider>
      <RealtimeDegradedProvider>
      <WorkspaceProvider orgId={orgId}>
        <PlanFeaturesProvider value={planFeatures}>
          <DialogsProvider data={referenceData}>
            {impersonation ? <ImpersonationBanner orgName={org.name} /> : null}
            <DunningBanner />
            <div className="flex flex-1 min-h-0">
              <Sidebar workspaces={workspaces} brands={brands} />
              <div className="flex flex-col flex-1 min-w-0 overflow-y-auto pb-[var(--ask-ai-clearance)]">
                <TopBar userName={user.name} workspaceName={org.name} workspaces={workspaces} />
                {children}
              </div>
            </div>
            <AppHotkeys />
            <CommandPalette />
            <ShortcutsDialog />
            <Onboarding />
            <AgentDrawer key={orgId} />
            <AgentCommandModal key={orgId} />
            <AskAiButton />
            <ProductTourAutostart enabled />
            <WorkspaceReminders />
          </DialogsProvider>
        </PlanFeaturesProvider>
      </WorkspaceProvider>
      </RealtimeDegradedProvider>
    </QueryProvider>
  )
}

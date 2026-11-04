import { redirect } from "next/navigation"
import { after } from "next/server"

import { AgentDrawer } from "@/components/agents/agent-drawer"
import { AppHotkeys } from "@/components/shared/app-hotkeys"
import { AppTopBar } from "@/components/shared/app-top-bar"
import { CommandPalette } from "@/components/shared/command-palette"
import { DialogsProvider } from "@/components/shared/dialogs-provider"
import { DunningBanner } from "@/components/shared/dunning-banner"
import { MobileNav } from "@/components/shared/mobile-nav"
import { Onboarding } from "@/components/shared/onboarding"
import { PostHogIdentify } from "@/components/shared/posthog-identify"
import { ProductTourRouteGuard } from "@/components/tour/product-tour"
import { PlanFeaturesProvider } from "@/components/shared/plan-features-provider"
import { QueryProvider } from "@/components/shared/query-provider"
import { ShortcutsDialog } from "@/components/shared/shortcuts-dialog"
import { Sidebar } from "@/components/shared/sidebar"
import { WorkspaceProvider } from "@/components/shared/workspace-provider"
import { WorkspaceReminders } from "@/components/shared/workspace-reminders"
import { ImpersonationBanner } from "@/components/control/impersonation-banner"
import { RealtimeDegradedProvider } from "@/lib/realtime/degraded-state"
import { fetchReferenceData } from "@/lib/queries/reference-data.server"
import { resolveImpersonation } from "@/lib/auth/impersonation"
import {
  getCurrentOrgId,
  getCurrentOrganisation,
  requireActiveOrg,
} from "@/lib/auth/server-helpers"
import { isOnboardingComplete } from "@/lib/onboarding/state"
import { touchWorkspaceActivity } from "@/lib/org/activity"
import { getOrgPlanFeatures } from "@/lib/plans/gate"
import { getWorkspaceSwitcherData } from "@/lib/queries/workspaces.server"
import { getBrandSwitcherData } from "@/lib/queries/brands.server"
import { getCurrentUserProfile } from "@/lib/identity/profile.server"

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
    getCurrentUserProfile(),
    getCurrentOrganisation(),
    getOrgPlanFeatures(orgId),
    resolveImpersonation(),
    getWorkspaceSwitcherData(),
    getBrandSwitcherData(),
  ])
  if (!impersonation) after(() => touchWorkspaceActivity(orgId, user.id))
  return (
    <QueryProvider>
      <RealtimeDegradedProvider>
      <WorkspaceProvider orgId={orgId}>
        <PlanFeaturesProvider value={planFeatures}>
          <DialogsProvider data={referenceData}>
            {impersonation ? <ImpersonationBanner orgName={org.name} /> : null}
            <DunningBanner />
            <MobileNav workspaces={workspaces} brands={brands} />
            <div className="@container/iface flex flex-1 min-h-0">
              <Sidebar
                workspaces={workspaces}
                brands={brands}
                user={{ name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl }}
              />
              <div className="flex flex-col flex-1 min-w-0 overflow-y-auto">
                <AppTopBar user={user} workspaceName={org.name} workspaces={workspaces} brands={brands} />
                {children}
              </div>
            </div>
            <AppHotkeys />
            <CommandPalette />
            <ShortcutsDialog />
            <Onboarding />
            <AgentDrawer key={orgId} />
            <ProductTourRouteGuard />
            <WorkspaceReminders />
            <PostHogIdentify
              userId={user.id}
              email={user.email ?? null}
              name={user.name}
              orgId={orgId}
              orgName={org.name}
              impersonating={Boolean(impersonation)}
            />
          </DialogsProvider>
        </PlanFeaturesProvider>
      </WorkspaceProvider>
      </RealtimeDegradedProvider>
    </QueryProvider>
  )
}

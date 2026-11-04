import { redirect } from "next/navigation"
import { after } from "next/server"

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
  getCurrentUser,
  orDown,
  requireActiveOrg,
} from "@/lib/auth/server-helpers"
import { isOnboardingComplete } from "@/lib/onboarding/state"
import { touchWorkspaceActivity } from "@/lib/org/activity"
import { getOrgPlanFeatures } from "@/lib/plans/gate"
import { getPlan, toPlanFeatures } from "@/lib/plans/plans"
import { DEFAULT_BRAND_ID } from "@/lib/constants/timbl"
import { IS_DEV_SHIM } from "@/lib/auth/dev-session"
import type { ReferenceData } from "@/lib/queries/reference-data.server"
import { getWorkspaceSwitcherData } from "@/lib/queries/workspaces.server"
import { getBrandSwitcherData } from "@/lib/queries/brands.server"
import { getCurrentUserProfile } from "@/lib/identity/profile.server"

export const metadata = { robots: { index: false, follow: false } }

/*
 * (app) tree shares one QueryClient + sidebar nav + global ⌘K palette + the
 * global DialogsProvider that mounts QuickAddDialog and PostComposerSheet
 * once for the whole app. The TopBar is mounted here once so every (app)
 * route renders identical chrome (Ask Timbl, Search, Quick add) without leaf
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
  if (!(await orDown(isOnboardingComplete(orgId), true))) {
    redirect("/onboarding")
  }
  const sessionUser = await getCurrentUser()
  const sessionOrg = await getCurrentOrganisation()
  const emptyBrand = {
    id: DEFAULT_BRAND_ID,
    name: sessionOrg.name,
    channels: [],
    voice: "",
    audience: "",
    perWeek: 0,
  }
  const emptyWorkspace = {
    id: orgId,
    name: sessionOrg.name,
    role: sessionUser.role,
    tier: "free" as const,
    channels: [],
    current: true,
  }
  const emptyReference: ReferenceData = {
    categories: [],
    ctas: [],
    users: [],
    campaigns: [],
    kanbanColumns: [],
    hashtagSuggestions: [],
    orgChannels: [],
  }
  const [referenceData, user, org, planFeatures, impersonation, workspaces, brands] = await Promise.all([
    orDown(fetchReferenceData(), emptyReference),
    orDown(getCurrentUserProfile(), {
      id: sessionUser.id,
      email: sessionUser.email,
      role: sessionUser.role,
      name: sessionUser.name,
    }),
    orDown(getCurrentOrganisation(), sessionOrg),
    orDown(getOrgPlanFeatures(orgId), { ...toPlanFeatures(getPlan("free")), billingStatus: "manual" }),
    orDown(resolveImpersonation(), null),
    orDown(getWorkspaceSwitcherData(), {
      current: emptyWorkspace,
      workspaces: [emptyWorkspace],
      canCreateWorkspace: false,
      isDevShim: IS_DEV_SHIM,
    }),
    orDown(getBrandSwitcherData(), { current: emptyBrand, brands: [emptyBrand], atCap: false }),
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

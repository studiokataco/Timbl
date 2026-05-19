import { AgentCommandModal } from "@/components/agents/agent-command-modal"
import { AgentDrawer } from "@/components/agents/agent-drawer"
import { AskAiButton } from "@/components/agents/ask-ai-button"
import { CommandPalette } from "@/components/shared/command-palette"
import { DialogsProvider } from "@/components/shared/dialogs-provider"
import { Onboarding } from "@/components/shared/onboarding"
import { PlanFeaturesProvider } from "@/components/shared/plan-features-provider"
import { QueryProvider } from "@/components/shared/query-provider"
import { Sidebar } from "@/components/shared/sidebar"
import { TopBar } from "@/components/shared/top-bar"
import { fetchReferenceData } from "@/lib/queries/reference-data.server"
import { getCurrentOrgId, getCurrentUser } from "@/lib/auth/server-helpers"
import { getOrgPlanFeatures } from "@/lib/plans/gate"

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
  const [referenceData, user, planFeatures] = await Promise.all([
    fetchReferenceData(),
    getCurrentUser(),
    getOrgPlanFeatures(orgId),
  ])
  return (
    <QueryProvider>
      <PlanFeaturesProvider value={planFeatures}>
        <DialogsProvider data={referenceData}>
          <div className="flex flex-1 min-h-0">
            <Sidebar />
            <div className="flex flex-col flex-1 min-w-0 overflow-y-auto">
              <TopBar userName={user.name} />
              {children}
            </div>
          </div>
          <CommandPalette />
          <Onboarding />
          <AgentDrawer />
          <AgentCommandModal />
          <AskAiButton />
        </DialogsProvider>
      </PlanFeaturesProvider>
    </QueryProvider>
  )
}

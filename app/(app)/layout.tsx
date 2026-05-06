import { CommandPalette } from "@/components/shared/command-palette"
import { DialogsProvider } from "@/components/shared/dialogs-provider"
import { Onboarding } from "@/components/shared/onboarding"
import { QueryProvider } from "@/components/shared/query-provider"
import { Sidebar } from "@/components/shared/sidebar"
import { fetchReferenceData } from "@/lib/queries/reference-data.server"

/*
 * (app) tree shares one QueryClient + sidebar nav + global ⌘K palette + the
 * global DialogsProvider that mounts QuickAddDialog and PostComposerSheet
 * once for the whole app. Reference data (categories / users / ctas /
 * campaigns / kanban columns / hashtag suggestions) is fetched here and
 * shared via context so any page can open Quick add / composer in place.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const referenceData = await fetchReferenceData()
  return (
    <QueryProvider>
      <DialogsProvider data={referenceData}>
        <div className="flex flex-1 min-h-0">
          <Sidebar />
          <div className="flex flex-col flex-1 min-w-0 overflow-y-auto">{children}</div>
        </div>
        <CommandPalette />
        <Onboarding />
      </DialogsProvider>
    </QueryProvider>
  )
}

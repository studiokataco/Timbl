import { CommandPalette } from "@/components/shared/command-palette"
import { Onboarding } from "@/components/shared/onboarding"
import { QueryProvider } from "@/components/shared/query-provider"
import { Sidebar } from "@/components/shared/sidebar"

/*
 * (app) tree shares one QueryClient + sidebar nav + global ⌘K palette.
 * The TopBar is rendered inside each page so it can wire into page-level
 * state (quick-add open, scoped filters, etc.).
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0">{children}</div>
      </div>
      <CommandPalette />
      <Onboarding />
    </QueryProvider>
  )
}

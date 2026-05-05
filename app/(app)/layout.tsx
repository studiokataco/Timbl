import { QueryProvider } from "@/components/shared/query-provider"

/*
 * (app) tree shares one QueryClient + a sticky TopBar. The TopBar lives
 * inside each page's CalendarShell instead of here so it can wire into the
 * page's quick-add state — see app/(app)/calendar/page.tsx.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <div className="flex flex-col flex-1">{children}</div>
    </QueryProvider>
  )
}

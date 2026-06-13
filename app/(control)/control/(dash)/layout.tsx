import { ShieldCheck } from "lucide-react"

import { ControlNav } from "@/components/control/control-nav"
import { ControlUserMenu } from "@/components/control/control-user-menu"
import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import { countPendingSignupRequests } from "@/lib/platform/queries"

/*
 * Control centre (platform super-admin) shell. Served only on the admin
 * host - the proxy rewrites admin.<domain>/* into this group and 404s
 * /control on every other host.
 *
 * requirePlatformAdmin() here gates the whole subtree, but it is NOT the
 * security boundary on its own - every platform server action re-checks
 * independently because actions are POST-invocable without a layout render.
 */

export const dynamic = "force-dynamic"

export const metadata = { robots: { index: false, follow: false } }

export default async function ControlLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [actor, pendingSignups] = await Promise.all([
    requirePlatformAdmin(),
    countPendingSignupRequests().catch(() => 0),
  ])
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5" />
          <span className="font-heading text-sm font-semibold tracking-tight">
            Control centre
          </span>
        </div>
        <ControlNav pendingSignups={pendingSignups} />
        <ControlUserMenu email={actor.email} />
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">{children}</main>
    </div>
  )
}

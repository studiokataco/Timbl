export const dynamic = "force-dynamic"

import Link from "next/link"
import { format, parseISO } from "date-fns"
import { Megaphone, Plus } from "lucide-react"
import { TopBar } from "@/components/shared/top-bar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { fetchCampaignWithPostCount } from "@/lib/actions/campaigns"

export default async function CampaignsPage() {
  const orgId = await getCurrentOrgId()
  const campaigns = await fetchCampaignWithPostCount(orgId)

  return (
    <>
      <TopBar />
      <div className="px-4 sm:px-6 py-4 flex-1">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-medium">Campaigns</h1>
            <p className="text-xs text-muted-foreground">
              Content series with a shared theme, timeline, and goal.
            </p>
          </div>
          <Button size="sm" render={<Link href="/settings/campaigns" />}>
            <Plus aria-hidden className="size-4" />
            Manage
          </Button>
        </div>

        {campaigns.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No campaigns yet"
            body="Group related posts into a series with a shared timeline, theme, and progress bar — useful for fundraising drives, anniversaries, or awareness weeks."
            action={
              <Button size="sm" render={<Link href="/settings/campaigns" />}>
                Create your first campaign
              </Button>
            }
            size="lg"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => {
              const pct =
                c.postCount > 0
                  ? Math.round((c.scheduledOrPosted / c.postCount) * 100)
                  : 0
              return (
                <Link
                  key={c.id}
                  href={`/campaigns/${c.slug ?? c.id}`}
                  className="rounded-lg border border-border bg-background p-4 hover:shadow-sm transition-shadow block"
                >
                  <div className="flex items-start gap-2 mb-2">
                    <span
                      className="mt-0.5 size-3 rounded-full shrink-0"
                      style={{ backgroundColor: c.color ?? "var(--color-muted-foreground)" }}
                      aria-hidden
                    />
                    <h2 className="font-medium leading-snug">{c.name}</h2>
                  </div>
                  {c.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                      {c.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                    {c.startDate && (
                      <span>{format(parseISO(c.startDate), "d MMM yyyy")}</span>
                    )}
                    {c.startDate && c.endDate && <span>→</span>}
                    {c.endDate && (
                      <span>{format(parseISO(c.endDate), "d MMM yyyy")}</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{c.postCount} posts</span>
                      <span className="text-muted-foreground">{pct}% ready</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: c.color ?? "var(--color-foreground)",
                        }}
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <Badge
                      variant="secondary"
                      className="text-xs font-normal capitalize"
                    >
                      {c.status}
                    </Badge>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

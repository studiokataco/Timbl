export const dynamic = "force-dynamic"

import Link from "next/link"
import { format, parseISO } from "date-fns"
import { Megaphone, Plus } from "lucide-react"
import { TopBar } from "@/components/shared/top-bar"
import { PageHeader } from "@/components/shared/page-header"
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
      <div className="flex-1 px-6 sm:px-10 py-10 lg:py-14">
        <div className="mx-auto w-full max-w-6xl space-y-8">
        <PageHeader
          title="Campaigns"
          description="Content series with a shared theme, timeline, and goal."
          action={
            <Button render={<Link href="/settings/campaigns" />}>
              <Plus aria-hidden className="size-4" />
              Manage
            </Button>
          }
        />

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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
            {campaigns.map((c) => {
              const pct =
                c.postCount > 0
                  ? Math.round((c.scheduledOrPosted / c.postCount) * 100)
                  : 0
              return (
                <Link
                  key={c.id}
                  href={`/campaigns/${c.slug ?? c.id}`}
                  className="rounded-lg border border-border bg-background p-6 hover:shadow-sm transition-shadow flex flex-col h-full"
                >
                  <div className="flex items-start gap-2 mb-2">
                    <span
                      className="mt-0.5 size-3 rounded-full shrink-0"
                      style={{ backgroundColor: c.color ?? "var(--color-muted-foreground)" }}
                      aria-hidden
                    />
                    <h2 className="font-medium leading-snug">{c.name}</h2>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2.5em] mb-3">
                    {c.description ?? ""}
                  </p>
                  <div className="mt-auto space-y-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
      </div>
    </>
  )
}

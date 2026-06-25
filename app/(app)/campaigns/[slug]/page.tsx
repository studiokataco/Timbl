export const dynamic = "force-dynamic"

import { notFound } from "next/navigation"
import { format, parseISO } from "date-fns"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getCurrentOrgId, getDb } from "@/lib/auth/server-helpers"
import { orgCampaignsPath, orgPostsPath, orgUsersPath, orgCategoriesPath } from "@/lib/firebase/paths"
import { snapToData } from "@/lib/firebase/serialize"
import { CampaignTimeline } from "@/components/campaigns/campaign-timeline"
import { fetchOrgChannels } from "@/lib/queries/reference-data.server"
import type { Campaign, Category, Post, User } from "@/lib/schemas"

type Props = { params: Promise<{ slug: string }> }

export default async function CampaignDetailPage({ params }: Props) {
  const { slug } = await params
  const orgId = await getCurrentOrgId()
  const db = getDb()

  const [campaignSnap, postsSnap, categoriesSnap, usersSnap, orgChannels] = await Promise.all([
    db.doc(`${orgCampaignsPath(orgId)}/${slug}`).get(),
    db
      .collection(orgPostsPath(orgId))
      .where("campaignId", "==", slug)
      .orderBy("scheduledDate", "asc")
      .get(),
    db.collection(orgCategoriesPath(orgId)).get(),
    db.collection(orgUsersPath(orgId)).get(),
    fetchOrgChannels(),
  ])

  if (!campaignSnap.exists) notFound()

  const campaign = snapToData<Campaign>(campaignSnap)
  const posts = postsSnap.docs.map((d) => snapToData<Post>(d))
  const categories = categoriesSnap.docs.map((d) => snapToData<Category>(d))
  const users = usersSnap.docs.map((d) => snapToData<User>(d))

  const statusCounts = posts.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1
    return acc
  }, {})
  const done = (statusCounts.scheduled ?? 0) + (statusCounts.posted ?? 0)
  const pct = posts.length > 0 ? Math.round((done / posts.length) * 100) : 0

  return (
    <>
      <div className="flex-1 px-4 py-6 sm:px-10 lg:py-14">
        <div className="w-full space-y-8">
          <div className="space-y-6">
            <Button variant="ghost" size="sm" className="-ml-2" render={<Link href="/campaigns" />}>
              <ArrowLeft aria-hidden className="size-4" />
              All campaigns
            </Button>
            <header className="flex items-start gap-4">
              {campaign.color && (
                <span
                  className="mt-3 size-3 rounded-full shrink-0"
                  style={{ backgroundColor: campaign.color }}
                  aria-hidden
                />
              )}
              <div className="space-y-3 min-w-0">
                <h1 className="text-display-sm md:text-display-md text-foreground">
                  {campaign.name}
                </h1>
                {campaign.description && (
                  <p className="text-body-md text-muted-foreground max-w-2xl">
                    {campaign.description}
                  </p>
                )}
                <div className="flex items-center gap-3 text-caption text-muted-foreground">
                  {campaign.startDate && (
                    <span>{format(parseISO(campaign.startDate), "d MMM yyyy")}</span>
                  )}
                  {campaign.startDate && campaign.endDate && <span>→</span>}
                  {campaign.endDate && (
                    <span>{format(parseISO(campaign.endDate), "d MMM yyyy")}</span>
                  )}
                  <Badge variant="secondary" className="capitalize font-normal">
                    {campaign.status}
                  </Badge>
                </div>
              </div>
            </header>

            <div className="flex items-center gap-6">
              <div className="flex-1 max-w-sm space-y-2">
                <div className="flex justify-between text-caption text-muted-foreground">
                  <span>{posts.length} posts</span>
                  <span>{pct}% ready</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: campaign.color ?? "var(--color-foreground)",
                    }}
                  />
                </div>
              </div>
              <div className="flex gap-3 flex-wrap text-caption text-muted-foreground">
                {Object.entries(statusCounts).map(([s, n]) => (
                  <span key={s}>
                    <span className="font-medium text-foreground">{n}</span> {s}
                  </span>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Posts use workspace categories shared across campaigns.{" "}
              <Link
                href="/settings/categories"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Manage categories
              </Link>
            </p>
          </div>

          <CampaignTimeline
            campaign={campaign}
            posts={posts}
            categories={categories}
            users={users}
            orgChannels={orgChannels}
          />
        </div>
      </div>
    </>
  )
}

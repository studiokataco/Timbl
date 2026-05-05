export const dynamic = "force-dynamic"

import { notFound } from "next/navigation"
import { format, parseISO } from "date-fns"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { TopBar } from "@/components/shared/top-bar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getCurrentOrgId, getDb } from "@/lib/auth/server-helpers"
import { orgCampaignsPath, orgPostsPath, orgUsersPath, orgCategoriesPath } from "@/lib/firebase/paths"
import { snapToData } from "@/lib/firebase/serialize"
import { CampaignTimeline } from "@/components/campaigns/campaign-timeline"
import type { Campaign, Category, Post, User } from "@/lib/schemas"

type Props = { params: Promise<{ slug: string }> }

export default async function CampaignDetailPage({ params }: Props) {
  const { slug } = await params
  const orgId = await getCurrentOrgId()
  const db = getDb()

  const [campaignSnap, postsSnap, categoriesSnap, usersSnap] = await Promise.all([
    db.doc(`${orgCampaignsPath(orgId)}/${slug}`).get(),
    db
      .collection(orgPostsPath(orgId))
      .where("campaignId", "==", slug)
      .orderBy("scheduledDate", "asc")
      .get(),
    db.collection(orgCategoriesPath(orgId)).get(),
    db.collection(orgUsersPath(orgId)).get(),
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
      <TopBar />
      <div className="px-4 sm:px-6 py-4 flex-1">
        <div className="mb-4">
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" render={<Link href="/campaigns" />}>
            <ArrowLeft aria-hidden className="size-4" />
            All campaigns
          </Button>
          <div className="flex items-start gap-3">
            {campaign.color && (
              <span
                className="mt-1.5 size-3 rounded-full shrink-0"
                style={{ backgroundColor: campaign.color }}
                aria-hidden
              />
            )}
            <div>
              <h1 className="text-lg font-medium">{campaign.name}</h1>
              {campaign.description && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {campaign.description}
                </p>
              )}
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                {campaign.startDate && (
                  <span>{format(parseISO(campaign.startDate), "d MMM yyyy")}</span>
                )}
                {campaign.startDate && campaign.endDate && <span>→</span>}
                {campaign.endDate && (
                  <span>{format(parseISO(campaign.endDate), "d MMM yyyy")}</span>
                )}
                <Badge variant="secondary" className="capitalize font-normal text-xs">
                  {campaign.status}
                </Badge>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 max-w-xs">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{posts.length} posts</span>
                <span>{pct}% ready</span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: campaign.color ?? "var(--color-signature-coral)",
                  }}
                />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap text-xs text-muted-foreground">
              {Object.entries(statusCounts).map(([s, n]) => (
                <span key={s}>
                  <span className="font-medium text-foreground">{n}</span> {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        <CampaignTimeline
          campaign={campaign}
          posts={posts}
          categories={categories}
          users={users}
        />
      </div>
    </>
  )
}

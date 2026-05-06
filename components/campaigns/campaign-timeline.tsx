"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO, startOfISOWeek, getISOWeek } from "date-fns"
import { CalendarRange } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import type { WithId } from "@/lib/firebase/serialize"
import type { Campaign, Category, Post, User } from "@/lib/schemas"
import { PostComposerSheet } from "@/components/composer/post-composer-sheet"
import { fetchPostAction } from "@/lib/actions/posts"
import { cn } from "@/lib/utils"

type Props = {
  campaign: WithId<Campaign>
  posts: WithId<Post>[]
  categories: WithId<Category>[]
  users: WithId<User>[]
}

type WeekGroup = { weekLabel: string; posts: WithId<Post>[] }

export function CampaignTimeline({ campaign, posts, categories, users }: Props) {
  const router = useRouter()
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerPost, setComposerPost] = useState<WithId<Post> | null>(null)

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )
  const userById = useMemo(
    () => new Map(users.map((u) => [u.id, u])),
    [users],
  )

  const weekGroups = useMemo<WeekGroup[]>(() => {
    const map = new Map<string, WithId<Post>[]>()
    for (const p of posts) {
      const d = parseISO(p.scheduledDate)
      const weekStart = startOfISOWeek(d)
      const key = weekStart.toISOString()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return Array.from(map.entries()).map(([, weekPosts]) => ({
      weekLabel: `Week ${getISOWeek(parseISO(weekPosts[0]!.scheduledDate))} · ${format(startOfISOWeek(parseISO(weekPosts[0]!.scheduledDate)), "d MMM")}`,
      posts: weekPosts,
    }))
  }, [posts])

  const openComposer = async (p: WithId<Post>) => {
    const fresh = await fetchPostAction(p.id)
    if (fresh) {
      setComposerPost(fresh)
      setComposerOpen(true)
    }
  }

  if (posts.length === 0) {
    return (
      <EmptyState
        icon={CalendarRange}
        title="No posts linked to this campaign yet"
        body="Open any post in the composer's Brief tab and assign it to this campaign — it'll appear here grouped by week."
        size="lg"
      />
    )
  }

  return (
    <>
      <div className="space-y-6">
        {weekGroups.map((week) => (
          <div key={week.weekLabel}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              {week.weekLabel}
            </h3>
            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {week.posts.map((p, i) => {
                    const cat = categoryById.get(p.categoryId ?? "")
                    const lead = userById.get(p.leadUserId ?? "")
                    return (
                      <tr
                        key={p.id}
                        className={cn(
                          "hover:bg-secondary/30",
                          i > 0 && "border-t border-border",
                        )}
                      >
                        <td className="p-2.5 w-24 whitespace-nowrap text-xs text-muted-foreground">
                          {format(parseISO(p.scheduledDate), "EEE d MMM")}
                        </td>
                        <td className="p-2.5 w-6">
                          {cat && (
                            <span
                              className="block size-2 rounded-full"
                              style={{ backgroundColor: cat.color }}
                              aria-hidden
                            />
                          )}
                        </td>
                        <td className="p-2.5 max-w-[280px] truncate">
                          {p.brief ?? <span className="italic text-muted-foreground">No brief</span>}
                        </td>
                        <td className="p-2.5 text-xs text-muted-foreground">
                          {lead?.name ?? ""}
                        </td>
                        <td className="p-2.5">
                          <Badge
                            variant="secondary"
                            className="capitalize font-normal text-xs"
                          >
                            {p.status}
                          </Badge>
                        </td>
                        <td className="p-2.5 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openComposer(p)}
                          >
                            Open
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <PostComposerSheet
        open={composerOpen}
        onOpenChange={setComposerOpen}
        post={composerPost}
        categories={categories}
        campaigns={[campaign]}
        ctas={[]}
        users={users}
        onChanged={() => router.refresh()}
      />
    </>
  )
}

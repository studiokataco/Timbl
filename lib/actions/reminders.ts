"use server"

import { addDays, differenceInDays, format, parseISO, subDays } from "date-fns"

import { getCurrentOrgId, getDb } from "@/lib/auth/server-helpers"
import { orgCategoriesPath, orgPostsPath } from "@/lib/firebase/paths"
import { snapToData, type WithId } from "@/lib/firebase/serialize"
import { fetchOrgChannels } from "@/lib/queries/reference-data.server"
import type { Category, ChannelKey, Post } from "@/lib/schemas"

const SILENT_CATEGORY_THRESHOLD_DAYS = 14
const LOOKBACK_DAYS = 90
const APPROVAL_HORIZON_DAYS = 3

export type WorkspaceReminder =
  | {
      id: "approval-due"
      kind: "approval-due"
      title: string
      description?: string
    }
  | {
      id: string
      kind: "overdue"
      title: string
      description?: string
      postId: string
    }
  | {
      id: string
      kind: "goes-live-soon"
      title: string
      description?: string
      postId: string
    }
  | {
      id: string
      kind: "silent-category"
      title: string
      description?: string
      categoryId: string
    }

function channelsIncomplete(post: Post, orgChannels: ChannelKey[]): boolean {
  for (const ch of orgChannels) {
    const st = post.channelStatuses?.[ch]
    if (!st || st === "n/a") return true
  }
  return false
}

export async function getWorkspaceReminders(): Promise<WorkspaceReminder[]> {
  const orgId = await getCurrentOrgId()
  const db = getDb()
  const today = new Date()
  const todayIso = format(today, "yyyy-MM-dd")
  const tomorrowIso = format(addDays(today, 1), "yyyy-MM-dd")
  const horizonIso = format(addDays(today, APPROVAL_HORIZON_DAYS), "yyyy-MM-dd")
  const lookbackIso = format(subDays(today, LOOKBACK_DAYS), "yyyy-MM-dd")

  const [postsSnap, catSnap, orgChannels] = await Promise.all([
    db
      .collection(orgPostsPath(orgId))
      .where("scheduledDate", ">=", lookbackIso)
      .where("scheduledDate", "<=", horizonIso)
      .get(),
    db.collection(orgCategoriesPath(orgId)).where("isActive", "==", true).get(),
    fetchOrgChannels(),
  ])

  const posts: WithId<Post>[] = postsSnap.docs.map((d) => snapToData<Post>(d))
  const categories: WithId<Category>[] = catSnap.docs.map((d) =>
    snapToData<Category>(d),
  )

  const reminders: WorkspaceReminder[] = []

  const approvalDue = posts.filter(
    (p) =>
      p.agentMeta?.reviewState === "pending" &&
      p.scheduledDate >= todayIso &&
      p.scheduledDate <= horizonIso,
  )
  if (approvalDue.length > 0) {
    reminders.push({
      id: "approval-due",
      kind: "approval-due",
      title:
        approvalDue.length === 1
          ? "1 draft needs review"
          : `${approvalDue.length} drafts need review`,
      description: "Scheduled in the next 3 days",
    })
  }

  for (const p of posts) {
    if (
      (p.status === "scheduled" || p.status === "draft") &&
      p.scheduledDate < todayIso
    ) {
      reminders.push({
        id: `overdue-${p.id}`,
        kind: "overdue",
        postId: p.id,
        title: "Overdue post",
        description: p.brief?.trim() || "Scheduled date has passed",
      })
    }
  }

  for (const p of posts) {
    if (p.status !== "scheduled") continue
    if (p.scheduledDate !== todayIso && p.scheduledDate !== tomorrowIso) continue
    if (!channelsIncomplete(p, orgChannels)) continue
    reminders.push({
      id: `goes-live-${p.id}`,
      kind: "goes-live-soon",
      postId: p.id,
      title: "Final check before publish",
      description: p.brief?.trim() || "Channels still need setup",
    })
  }

  const recentByCategory = new Map<string, string>()
  for (const p of posts) {
    if (!p.categoryId) continue
    const prev = recentByCategory.get(p.categoryId)
    if (!prev || p.scheduledDate > prev) {
      recentByCategory.set(p.categoryId, p.scheduledDate)
    }
  }

  const silentCandidates: { categoryId: string; name: string; daysSilent: number }[] =
    []
  for (const cat of categories) {
    const last = recentByCategory.get(cat.id)
    const daysSilent = last
      ? differenceInDays(today, parseISO(last))
      : SILENT_CATEGORY_THRESHOLD_DAYS
    if (daysSilent >= SILENT_CATEGORY_THRESHOLD_DAYS) {
      silentCandidates.push({
        categoryId: cat.id,
        name: cat.name,
        daysSilent: Number.isFinite(daysSilent) ? daysSilent : SILENT_CATEGORY_THRESHOLD_DAYS,
      })
    }
  }
  silentCandidates.sort((a, b) => b.daysSilent - a.daysSilent)
  const topSilent = silentCandidates[0]
  if (topSilent) {
    reminders.push({
      id: `silent-${topSilent.categoryId}`,
      kind: "silent-category",
      categoryId: topSilent.categoryId,
      title: `Plan a ${topSilent.name} post`,
      description: `No posts in ${topSilent.daysSilent}+ days`,
    })
  }

  return reminders.slice(0, 5)
}

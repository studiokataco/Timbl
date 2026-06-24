"use server"

import { getCurrentOrgId, getCurrentUser, getDb } from "@/lib/auth/server-helpers"
import { orgPostsPath } from "@/lib/firebase/paths"
import { snapToData, type WithId } from "@/lib/firebase/serialize"
import type { Post } from "@/lib/schemas"

export type AppNotification = {
  postId: string
  brief: string
  status: Post["status"]
  updatedAt: string
}

/*
 * Derived, read-only activity feed for the header bell. We don't keep a
 * notifications collection - we surface recent updates to posts the current
 * user is related to (assignee or approver), newest first. Actor/from->to
 * enrichment lives in each post's statusHistory subcollection and is left for
 * a later pass.
 */
export async function fetchNotificationsAction(): Promise<AppNotification[]> {
  const orgId = await getCurrentOrgId()
  const user = await getCurrentUser()
  const db = getDb()
  const posts = db.collection(orgPostsPath(orgId))

  const [assigned, approver] = await Promise.all([
    posts.where("assigneeId", "==", user.id).get(),
    posts.where("approvedBy", "array-contains", user.id).get(),
  ])

  const byId = new Map<string, WithId<Post>>()
  for (const d of [...assigned.docs, ...approver.docs]) {
    byId.set(d.id, snapToData<Post>(d))
  }

  return [...byId.values()]
    .filter((p): p is WithId<Post> & { updatedAt: string } => Boolean(p.updatedAt))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .slice(0, 20)
    .map((p) => ({
      postId: p.id,
      brief: p.brief ?? "Untitled",
      status: p.status,
      updatedAt: p.updatedAt,
    }))
}

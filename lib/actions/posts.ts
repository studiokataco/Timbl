"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getCurrentOrgId, getCurrentUser, getDb } from "@/lib/auth/server-helpers"
import {
  orgCategoriesPath,
  orgPostsPath,
  orgPostStatusHistoryPath,
} from "@/lib/firebase/paths"
import { snapToData, type WithId } from "@/lib/firebase/serialize"
import { postSchema, postStatus as postStatusSchema, quickAddPostSchema, type Post } from "@/lib/schemas"

/*
 * Post mutations. Every action:
 *   1. Calls getCurrentOrgId() FIRST.
 *   2. Validates input through a Zod schema.
 *   3. Writes under /organizations/{orgId}/posts.
 *
 * Until Phase 7 the Admin SDK bypasses Firestore Security Rules — the
 * org-scoped write paths above are the only thing keeping tenants isolated.
 * Phase 7's auth swap moves these calls to a user-scoped client; the rules
 * then engage as a second defense layer.
 */

const updateInputSchema = postSchema
  .partial()
  .extend({ id: z.string().min(1) })

const ServerActionResult = z.object({
  ok: z.boolean(),
  id: z.string().optional(),
  error: z.string().optional(),
})
export type ServerActionResult = z.infer<typeof ServerActionResult>

export async function createQuickAddPost(input: unknown): Promise<ServerActionResult> {
  const parsed = quickAddPostSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const orgId = await getCurrentOrgId()
  const user = await getCurrentUser()
  const db = getDb()

  // Pull category defaults so the post lands fully populated even from the
  // 3-field quick-add path. This is the heart of the "<30 second add" promise.
  const categoryRef = db.doc(`${orgCategoriesPath(orgId)}/${parsed.data.categoryId}`)
  const categorySnap = await categoryRef.get()
  if (!categorySnap.exists) {
    return { ok: false, error: "Selected category does not exist" }
  }
  const category = snapToData<{
    defaultPostType?: Post["postType"]
    defaultHashtags?: string[]
    defaultCtaId?: string
    defaultLeadId?: string
  }>(categorySnap)

  const postsRef = db.collection(orgPostsPath(orgId)).doc()
  const now = new Date().toISOString()

  const doc: Post = {
    id: postsRef.id,
    organizationId: orgId,
    scheduledDate: parsed.data.scheduledDate,
    status: "idea",
    categoryId: parsed.data.categoryId,
    postType: category.defaultPostType ?? "grid",
    brief: parsed.data.brief,
    hashtags: category.defaultHashtags ?? [],
    ctaId: category.defaultCtaId,
    leadUserId: category.defaultLeadId,
    assigneeId: user.id,
    assetUrls: [],
    channelStatuses: {},
    createdAt: now,
    updatedAt: now,
  }

  await postsRef.set(doc)
  revalidatePath("/calendar")
  return { ok: true, id: postsRef.id }
}

export async function updatePost(input: unknown): Promise<ServerActionResult> {
  const parsed = updateInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const orgId = await getCurrentOrgId()
  const user = await getCurrentUser()
  const db = getDb()
  const { id, ...patch } = parsed.data
  const ref = db.doc(`${orgPostsPath(orgId)}/${id}`)
  const existing = await ref.get()
  if (!existing.exists) return { ok: false, error: "Post not found" }

  // Capture status transitions in a per-post statusHistory subcollection.
  const prevStatus = existing.data()?.status as Post["status"] | undefined
  const nextStatus = parsed.data.status
  const statusChanged =
    nextStatus && postStatusSchema.safeParse(nextStatus).success && nextStatus !== prevStatus

  const batch = db.batch()
  batch.set(
    ref,
    { ...patch, updatedAt: new Date().toISOString() },
    { merge: true },
  )
  if (statusChanged) {
    batch.set(
      db.collection(orgPostStatusHistoryPath(orgId, id)).doc(),
      {
        from: prevStatus ?? null,
        to: nextStatus,
        userId: user.id,
        at: new Date().toISOString(),
      },
    )
  }
  await batch.commit()
  revalidatePath("/calendar")
  revalidatePath("/posts")
  return { ok: true, id }
}

export async function deletePost(id: string): Promise<ServerActionResult> {
  if (!id) return { ok: false, error: "Missing post id" }
  const orgId = await getCurrentOrgId()
  await getDb().doc(`${orgPostsPath(orgId)}/${id}`).delete()
  revalidatePath("/calendar")
  return { ok: true, id }
}

export async function fetchPostAction(id: string): Promise<WithId<Post> | null> {
  const orgId = await getCurrentOrgId()
  const snap = await getDb().doc(`${orgPostsPath(orgId)}/${id}`).get()
  return snap.exists ? snapToData<Post>(snap) : null
}

/*
 * Compact projection used by the Studio publish-status chips. Mirrors the
 * canonical Post fields but limits the surface to what the chip renders, so
 * the activity stream's batched fetch stays cheap. `status` is the kanban
 * status string (one of the seeded values: idea / brief / researching /
 * designing / review / scheduled / posted / missed / archived), kept as a
 * raw string because the schema declares postStatus as an open enum.
 */
export type PublishStatusProjection = {
  id: string
  brief?: string
  status: string
  scheduledDate?: string
  scheduledTime?: string
  postedAt?: string
  channelStatuses?: Record<string, unknown>
}

const getPostsByIdsInput = z.object({
  ids: z.array(z.string().min(1)).max(30),
})

/*
 * Batched read for publish-state surfacing in /studio. The activity stream
 * dedupes postIds across visible runs and pulls them all here in one call —
 * the cap at 30 keeps Firestore reads bounded since each id is its own
 * `doc().get()`. Returns only the projection used by `<PublishChip />`.
 */
export async function getPostsByIds(
  input: unknown,
): Promise<PublishStatusProjection[]> {
  const parsed = getPostsByIdsInput.safeParse(input)
  if (!parsed.success) return []
  const ids = Array.from(new Set(parsed.data.ids)).slice(0, 30)
  if (ids.length === 0) return []

  const orgId = await getCurrentOrgId()
  const db = getDb()
  const refs = ids.map((id) => db.doc(`${orgPostsPath(orgId)}/${id}`))
  const snaps = await db.getAll(...refs)

  const out: PublishStatusProjection[] = []
  for (const snap of snaps) {
    if (!snap.exists) continue
    const post = snapToData<Post>(snap)
    out.push({
      id: post.id,
      brief: post.brief,
      status: post.status,
      scheduledDate: post.scheduledDate,
      scheduledTime: post.scheduledTime,
      postedAt: post.postedAt,
      channelStatuses: post.channelStatuses as Record<string, unknown>,
    })
  }
  return out
}

/*
 * Cheap aggregation for the Pipeline graph's Publish lane. Counts posts in
 * `scheduled` and `posted` states across the whole org. Bounded by an
 * implicit per-status `limit(500)` so a runaway scrape can't melt the
 * emulator; the UI only needs the magnitudes, not exact totals.
 */
export async function countPublishablePosts(): Promise<{
  scheduled: number
  posted: number
}> {
  const orgId = await getCurrentOrgId()
  const db = getDb()
  const col = db.collection(orgPostsPath(orgId))
  const [scheduledSnap, postedSnap] = await Promise.all([
    col.where("status", "==", "scheduled").limit(500).get(),
    col.where("status", "==", "posted").limit(500).get(),
  ])
  return { scheduled: scheduledSnap.size, posted: postedSnap.size }
}

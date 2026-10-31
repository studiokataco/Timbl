"use server"

import { addDays, addWeeks } from "date-fns"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getCurrentOrgId, getCurrentUser, getDb } from "@/lib/auth/server-helpers"
import {
  orgCategoriesPath,
  orgCountersDocPath,
  orgPostsPath,
  orgPostStatusHistoryPath,
} from "@/lib/firebase/paths"
import { HUMAN_ID_PREFIX } from "@/lib/constants/timbl"
import { getCurrentBrandId } from "@/lib/brand/brand-session"
import { snapToData, type WithId } from "@/lib/firebase/serialize"
import { embedIfChanged } from "@/lib/embeddings/embeddable"
import { gateErrorToResult, requireQuota } from "@/lib/plans/gate"
import { incrementUsage } from "@/lib/telemetry/agent-events"
import { fetchPostsInRange } from "@/lib/queries/posts.server"
import { postPatchSchema, postStatus as postStatusSchema, quickAddPostSchema, type Post, type ServerActionResult } from "@/lib/schemas"
import { withSyncedPostTypes } from "@/lib/post-types"
import { writePostActivity } from "@/lib/actions/post-activity"
import { recordActivationMilestone } from "@/lib/telemetry/activation"

import { FieldValue, type Firestore } from "firebase-admin/firestore"

export async function nextHumanId(orgId: string, db: Firestore): Promise<string> {
  const counterRef = db.doc(orgCountersDocPath(orgId, "postSeq"))
  let next = 1
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef)
    const seq = snap.exists ? ((snap.data()?.seq as number) ?? 0) : 0
    next = seq + 1
    tx.set(counterRef, { seq: next }, { merge: true })
  })
  return `${HUMAN_ID_PREFIX}-${next}`
}

/* Client-callable wrapper around the server-only fetchPostsInRange. Used by
 * the calendar's client useQuery to refetch when the user navigates months
 * past the SSR-hydrated window (eg. Oct 2026 when SSR fetched today±60d). */
const rangeInput = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function fetchPostsInRangeAction(
  input: z.infer<typeof rangeInput>,
): Promise<WithId<Post>[]> {
  const { start, end } = rangeInput.parse(input)
  return fetchPostsInRange(start, end)
}

/*
 * Post mutations. Every action:
 *   1. Calls getCurrentOrgId() FIRST.
 *   2. Validates input through a Zod schema.
 *   3. Writes under /organizations/{orgId}/posts.
 *
 * Until Phase 7 the Admin SDK bypasses Firestore Security Rules - the
 * org-scoped write paths above are the only thing keeping tenants isolated.
 * Phase 7's auth swap moves these calls to a user-scoped client; the rules
 * then engage as a second defense layer.
 */

const updateInputSchema = postPatchSchema.extend({ id: z.string().min(1) })

export async function createQuickAddPost(input: unknown): Promise<ServerActionResult> {
  const parsed = quickAddPostSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const orgId = await getCurrentOrgId()
  const brandId = await getCurrentBrandId(orgId)
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
  const humanId = await nextHumanId(orgId, db)

  const defaultType = category.defaultPostType ?? "grid"
  const typeFields = withSyncedPostTypes([defaultType])

  const doc: Post = {
    id: postsRef.id,
    humanId,
    organizationId: orgId,
    brandId,
    scheduledDate: parsed.data.scheduledDate,
    status: "idea",
    categoryId: parsed.data.categoryId,
    ...typeFields,
    brief: parsed.data.brief,
    hashtags: category.defaultHashtags ?? [],
    ctaId: category.defaultCtaId,
    leadUserId: category.defaultLeadId,
    assigneeId: user.id,
    assetUrls: [],
    designLinks: [],
    channelStatuses: {},
    createdAt: now,
    updatedAt: now,
  }

  await postsRef.set(doc)
  await writePostActivity(orgId, postsRef.id, user.id, "created", { brief: doc.brief ?? null }, db)
  try {
    await embedIfChanged("post", orgId, postsRef.id, doc as unknown as Record<string, unknown>)
  } catch (err) {
    console.warn(`[embed] post create soft-fail: ${err instanceof Error ? err.message : err}`)
  }
  await recordActivationMilestone(orgId, "first_draft_created", user.id, { source: "quick_add" })
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
  if (patch.postTypes?.length) {
    Object.assign(patch, withSyncedPostTypes(patch.postTypes))
  } else if (patch.postType) {
    Object.assign(patch, withSyncedPostTypes([patch.postType]))
  }
  const ref = db.doc(`${orgPostsPath(orgId)}/${id}`)
  const existing = await ref.get()
  if (!existing.exists) return { ok: false, error: "Post not found" }

  // Capture status transitions in a per-post statusHistory subcollection.
  const prevStatus = existing.data()?.status as Post["status"] | undefined
  const nextStatus = parsed.data.status
  const statusChanged =
    nextStatus && postStatusSchema.safeParse(nextStatus).success && nextStatus !== prevStatus

  /* Gate the scheduledPosts quota on the transition INTO scheduled. We
   * deliberately don't gate on every other status change (only this one
   * costs against the plan) and don't double-count if the post is
   * already scheduled. */
  if (statusChanged && nextStatus === "scheduled") {
    try {
      await requireQuota(orgId, "scheduledPosts")
    } catch (err) {
      const gated = gateErrorToResult(err)
      if (gated) return gated
      throw err
    }
  }

  const write = Object.fromEntries(
    Object.entries(patch).map(([key, value]) => [key, value === null ? FieldValue.delete() : value]),
  )
  const batch = db.batch()
  batch.set(
    ref,
    { ...write, updatedAt: new Date().toISOString() },
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

  // Emit activity entries — best-effort, never block the save.
  try {
    const prev = existing.data() as Partial<Post>
    if (statusChanged) {
      await writePostActivity(orgId, id, user.id, "status", { from: prevStatus ?? null, to: nextStatus }, db)
    } else if (patch.scheduledDate !== undefined || patch.scheduledTime !== undefined) {
      await writePostActivity(orgId, id, user.id, "dates", { date: patch.scheduledDate ?? prev.scheduledDate ?? null }, db)
    } else if (patch.priority !== undefined && patch.priority !== prev.priority) {
      await writePostActivity(orgId, id, user.id, "priority", { priority: patch.priority }, db)
    } else if (patch.assigneeId !== undefined && patch.assigneeId !== prev.assigneeId) {
      await writePostActivity(orgId, id, user.id, "assignee", { id: patch.assigneeId ?? null }, db)
    } else if (patch.categoryId !== undefined && patch.categoryId !== prev.categoryId) {
      await writePostActivity(orgId, id, user.id, "category", { id: patch.categoryId ?? null }, db)
    } else if (patch.hashtags !== undefined) {
      await writePostActivity(orgId, id, user.id, "hashtags", { tags: patch.hashtags }, db)
    } else if (Object.keys(patch).some((k) => !["updatedAt", "postType", "postTypes"].includes(k))) {
      await writePostActivity(orgId, id, user.id, "edit", {}, db)
    }
  } catch (err) {
    console.warn(`[activity] updatePost soft-fail: ${err instanceof Error ? err.message : err}`)
  }

  /* Bump the scheduledPosts counter AFTER the write succeeds so a failed
   * batch doesn't waste quota. Best-effort - never blocks the user. */
  if (statusChanged && nextStatus === "scheduled") {
    try {
      await incrementUsage(orgId, "scheduledPosts")
    } catch (err) {
      console.warn(
        `[usage] scheduledPosts increment failed: ${err instanceof Error ? err.message : err}`,
      )
    }
  }

  if (statusChanged && nextStatus === "scheduled") {
    await recordActivationMilestone(orgId, "first_post_scheduled", user.id, { source: "status_change" })
  } else if (statusChanged && nextStatus === "posted") {
    await recordActivationMilestone(orgId, "first_post_published", user.id, { source: "marked_posted" })
  }

  try {
    const after = await ref.get()
    if (after.exists) {
      await embedIfChanged("post", orgId, id, { ...after.data(), id } as Record<string, unknown>)
    }
  } catch (err) {
    console.warn(`[embed] post update soft-fail: ${err instanceof Error ? err.message : err}`)
  }
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
 * dedupes postIds across visible runs and pulls them all here in one call -
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

const RECURRENCE_OCCURRENCES = 12

export async function expandRecurrence(input: { postId: string }): Promise<ServerActionResult> {
  const { postId } = input
  if (!postId) return { ok: false, error: "Missing postId" }

  const orgId = await getCurrentOrgId()
  const db = getDb()
  const postsRef = db.collection(orgPostsPath(orgId))

  const snap = await postsRef.doc(postId).get()
  if (!snap.exists) return { ok: false, error: "Post not found" }

  const post = snap.data() as Post
  const recurrence = post.recurrence
  if (!recurrence) return { ok: false, error: "Post has no recurrence rule" }

  const baseDate = post.scheduledDate ? new Date(post.scheduledDate) : new Date()
  const { freq, interval = 1 } = recurrence

  const advance = (date: Date, step: number): Date =>
    freq === "daily" ? addDays(date, step * interval) : addWeeks(date, step * interval)

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, humanId: _humanId, recurrence: _recurrence, ...basePost } = post

  const batch = db.batch()
  for (let i = 1; i <= RECURRENCE_OCCURRENCES; i++) {
    const newRef = postsRef.doc()
    const scheduledDate = advance(baseDate, i).toISOString().slice(0, 10)
    const newHumanId = await nextHumanId(orgId, db)
    const now = new Date().toISOString()
    batch.set(newRef, {
      ...basePost,
      id: newRef.id,
      humanId: newHumanId,
      scheduledDate,
      createdAt: now,
      updatedAt: now,
    })
  }
  await batch.commit()

  revalidatePath("/calendar")
  return { ok: true, id: postId }
}

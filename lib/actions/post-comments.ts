"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getCurrentOrgId, getCurrentUser, getDb } from "@/lib/auth/server-helpers"
import { orgPostCommentsPath } from "@/lib/firebase/paths"
import { commentSchema, type Comment } from "@/lib/schemas/comment"
import type { ServerActionResult } from "@/lib/schemas"
import { writePostActivity } from "./post-activity"

export async function addComment(input: {
  postId: string
  body: string
  isInternal?: boolean
  parentId?: string
  mentions?: string[]
}): Promise<ServerActionResult> {
  try {
    const [orgId, user, db] = await Promise.all([
      getCurrentOrgId(),
      getCurrentUser(),
      getDb(),
    ])
    const parsed = commentSchema
      .pick({ body: true, isInternal: true, parentId: true })
      .parse({ body: input.body, isInternal: input.isInternal, parentId: input.parentId })
    const now = new Date().toISOString()
    const ref = db.collection(orgPostCommentsPath(orgId, input.postId)).doc()
    await ref.set({
      postId: input.postId,
      authorId: user.id,
      body: parsed.body,
      isInternal: parsed.isInternal ?? false,
      mentions: input.mentions ?? [],
      reactions: [],
      ...(parsed.parentId ? { parentId: parsed.parentId } : {}),
      createdAt: now,
      updatedAt: now,
    })
    await writePostActivity(
      orgId,
      input.postId,
      user.id,
      "comment",
      { body: input.body.slice(0, 200) },
      db,
    )
    revalidatePath("/posts")
    return { ok: true, id: ref.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" }
  }
}

export async function editComment(input: {
  postId: string
  commentId: string
  body: string
  mentions?: string[]
}): Promise<ServerActionResult> {
  try {
    const [orgId, user, db] = await Promise.all([
      getCurrentOrgId(),
      getCurrentUser(),
      getDb(),
    ])
    const ref = db
      .collection(orgPostCommentsPath(orgId, input.postId))
      .doc(input.commentId)
    const snap = await ref.get()
    if (!snap.exists) return { ok: false, error: "Comment not found" }
    if (snap.data()?.authorId !== user.id) return { ok: false, error: "Not authorized" }
    const { body } = commentSchema.pick({ body: true }).parse({ body: input.body })
    const now = new Date().toISOString()
    await ref.set(
      { body, editedAt: now, ...(input.mentions ? { mentions: input.mentions } : {}), updatedAt: now },
      { merge: true },
    )
    revalidatePath("/posts")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" }
  }
}

export async function deleteComment(input: {
  postId: string
  commentId: string
}): Promise<ServerActionResult> {
  try {
    const [orgId, user, db] = await Promise.all([
      getCurrentOrgId(),
      getCurrentUser(),
      getDb(),
    ])
    const ref = db
      .collection(orgPostCommentsPath(orgId, input.postId))
      .doc(input.commentId)
    const snap = await ref.get()
    if (!snap.exists) return { ok: false, error: "Comment not found" }
    if (snap.data()?.authorId !== user.id) return { ok: false, error: "Not authorized" }
    await ref.delete()
    revalidatePath("/posts")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" }
  }
}

export async function toggleCommentReaction(input: {
  postId: string
  commentId: string
  emoji: "👍" | "❤️" | "🎉" | "😂" | "👀" | "🙌" | "🔥" | "✅"
}): Promise<ServerActionResult> {
  try {
    const [orgId, user, db] = await Promise.all([
      getCurrentOrgId(),
      getCurrentUser(),
      getDb(),
    ])
    const ref = db
      .collection(orgPostCommentsPath(orgId, input.postId))
      .doc(input.commentId)
    const snap = await ref.get()
    if (!snap.exists) return { ok: false, error: "Comment not found" }
    const reactions = (Array.isArray(snap.data()?.reactions) ? snap.data()?.reactions : []) as {
      emoji?: string
      userIds?: string[]
    }[]
    const next = reactions.map((row) => ({
      emoji: row.emoji,
      userIds: Array.isArray(row.userIds) ? [...row.userIds] : [],
    }))
    const index = next.findIndex((row) => row.emoji === input.emoji)
    if (index < 0) {
      next.push({ emoji: input.emoji, userIds: [user.id] })
    } else {
      const ids = next[index].userIds
      next[index].userIds = ids.includes(user.id)
        ? ids.filter((id: string) => id !== user.id)
        : [...ids, user.id]
    }
    await ref.set(
      { reactions: next.filter((row) => row.userIds.length > 0), updatedAt: new Date().toISOString() },
      { merge: true },
    )
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" }
  }
}

const listInput = z.array(z.string().min(1)).max(60)

export async function listPostComments(postIds: unknown): Promise<Comment[]> {
  const ids = listInput.parse(postIds)
  if (ids.length === 0) return []
  const [orgId, db] = await Promise.all([getCurrentOrgId(), getDb()])
  const groups = await Promise.all(
    ids.map((postId) => db.collection(orgPostCommentsPath(orgId, postId)).orderBy("createdAt").limit(100).get()),
  )
  return groups.flatMap((snap, i) =>
    snap.docs.flatMap((doc) => {
      const parsed = commentSchema.safeParse({ ...doc.data(), id: doc.id, postId: ids[i] })
      return parsed.success ? [parsed.data] : []
    }),
  )
}

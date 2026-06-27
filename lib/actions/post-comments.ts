"use server"

import { revalidatePath } from "next/cache"
import { getCurrentOrgId, getCurrentUser, getDb } from "@/lib/auth/server-helpers"
import { orgPostCommentsPath } from "@/lib/firebase/paths"
import { commentSchema } from "@/lib/schemas/comment"
import type { ServerActionResult } from "@/lib/schemas"
import { writePostActivity } from "./post-activity"

export async function addComment(input: {
  postId: string
  body: string
  isInternal?: boolean
  parentId?: string
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
    await ref.set({ body, updatedAt: new Date().toISOString() }, { merge: true })
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

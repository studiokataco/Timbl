"use server"

import { z } from "zod"
import { FieldValue } from "firebase-admin/firestore"
import { getCurrentOrgId, getDb } from "@/lib/auth/server-helpers"
import { orgPostsPath } from "@/lib/firebase/paths"
import { snapToData, type WithId } from "@/lib/firebase/serialize"
import type { Post, ServerActionResult } from "@/lib/schemas"

const mutateSchema = z.object({
  postId: z.string().min(1),
  relatedId: z.string().min(1),
})

export async function addRelatedPost(input: unknown): Promise<ServerActionResult> {
  const parsed = mutateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" }
  if (parsed.data.postId === parsed.data.relatedId) {
    return { ok: false, error: "Cannot relate a post to itself" }
  }
  const orgId = await getCurrentOrgId()
  const db = getDb()
  const ref = db.collection(orgPostsPath(orgId)).doc(parsed.data.postId)
  const snap = await ref.get()
  if (!snap.exists || snap.data()?.organizationId !== orgId) {
    return { ok: false, error: "Post not found" }
  }
  await ref.update({
    relatedPostIds: FieldValue.arrayUnion(parsed.data.relatedId),
    updatedAt: new Date().toISOString(),
  })
  return { ok: true }
}

export async function removeRelatedPost(input: unknown): Promise<ServerActionResult> {
  const parsed = mutateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" }
  const orgId = await getCurrentOrgId()
  const db = getDb()
  await db.collection(orgPostsPath(orgId)).doc(parsed.data.postId).update({
    relatedPostIds: FieldValue.arrayRemove(parsed.data.relatedId),
    updatedAt: new Date().toISOString(),
  })
  return { ok: true }
}

export async function fetchRelatedPosts(postId: string): Promise<WithId<Post>[]> {
  const orgId = await getCurrentOrgId()
  const db = getDb()
  const snap = await db.collection(orgPostsPath(orgId)).doc(postId).get()
  if (!snap.exists) return []
  const ids: string[] = (snap.data()?.relatedPostIds as string[] | undefined) ?? []
  if (ids.length === 0) return []
  const results: WithId<Post>[] = []
  for (let i = 0; i < ids.length; i += 30) {
    const batch = ids.slice(i, i + 30)
    const docs = await db
      .collection(orgPostsPath(orgId))
      .where("id", "in", batch)
      .get()
    docs.forEach((d) => results.push(snapToData<Post>(d)))
  }
  return results
}

export async function listRecentPosts(exclude?: string): Promise<WithId<Post>[]> {
  const orgId = await getCurrentOrgId()
  const snap = await getDb()
    .collection(orgPostsPath(orgId))
    .orderBy("updatedAt", "desc")
    .limit(40)
    .get()
  return snap.docs
    .map((d) => snapToData<Post>(d))
    .filter((p) => p.id !== exclude)
}

"use server"

import { revalidatePath } from "next/cache"
import { getCurrentOrgId, getCurrentUser, getDb } from "@/lib/auth/server-helpers"
import {
  orgNotificationsPath,
  orgPostActivityPath,
  orgPostFollowersPath,
} from "@/lib/firebase/paths"
import { snapToData } from "@/lib/firebase/serialize"
import type { PostActivity, PostActivityType } from "@/lib/schemas/postActivity"
import type { ServerActionResult } from "@/lib/schemas"
import type { Firestore } from "firebase-admin/firestore"

export async function writePostActivity(
  orgId: string,
  postId: string,
  actorId: string,
  type: PostActivityType,
  payload: Record<string, unknown>,
  db: Firestore,
): Promise<void> {
  try {
    const now = new Date().toISOString()
    const ref = db.collection(orgPostActivityPath(orgId, postId)).doc()
    await ref.set({ postId, actorId, type, payload, createdAt: now })

    // Fan out to followers (exclude actor). Best-effort — never throws.
    const followersSnap = await db.collection(orgPostFollowersPath(orgId, postId)).get()
    const recipients = followersSnap.docs
      .map((d) => (d.data().userId as string) ?? d.id)
      .filter((uid) => uid !== actorId)
    if (recipients.length > 0) {
      const batch = db.batch()
      for (const uid of recipients) {
        batch.set(db.collection(orgNotificationsPath(orgId)).doc(), {
          recipientId: uid,
          actorId,
          postId,
          type,
          createdAt: now,
          read: false,
        })
      }
      await batch.commit()
    }
  } catch (err) {
    console.error("[writePostActivity] failed", { orgId, postId, type, err })
  }
}

export async function fetchPostActivity(postId: string): Promise<PostActivity[]> {
  const [orgId, db] = await Promise.all([getCurrentOrgId(), getDb()])
  const snap = await db
    .collection(orgPostActivityPath(orgId, postId))
    .orderBy("createdAt", "desc")
    .limit(100)
    .get()
  return snap.docs.map((d) => snapToData<PostActivity>(d))
}

export async function togglePostFollow(postId: string): Promise<ServerActionResult> {
  try {
    const [orgId, user, db] = await Promise.all([
      getCurrentOrgId(),
      getCurrentUser(),
      getDb(),
    ])
    const ref = db
      .collection(orgPostFollowersPath(orgId, postId))
      .doc(user.id)
    const snap = await ref.get()
    if (snap.exists) {
      await ref.delete()
      await writePostActivity(orgId, postId, user.id, "follow", { action: "unfollow" }, db)
    } else {
      await ref.set({ userId: user.id, followedAt: new Date().toISOString() })
      await writePostActivity(orgId, postId, user.id, "follow", { action: "follow" }, db)
    }
    revalidatePath("/posts")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" }
  }
}

export async function fetchPostFollowers(postId: string): Promise<string[]> {
  const [orgId, db] = await Promise.all([getCurrentOrgId(), getDb()])
  const snap = await db.collection(orgPostFollowersPath(orgId, postId)).get()
  return snap.docs.map((d) => (d.data().userId as string) ?? d.id)
}

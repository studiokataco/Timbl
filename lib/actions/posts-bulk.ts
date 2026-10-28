"use server"

import { revalidatePath } from "next/cache"
import { getCurrentOrgId, getCurrentUser, getDb } from "@/lib/auth/server-helpers"
import {
  orgPostsPath,
  orgPostStatusHistoryPath,
} from "@/lib/firebase/paths"
import type { PostStatus } from "@/lib/schemas"
import { recordActivationMilestone } from "@/lib/telemetry/activation"

/*
 * Bulk transition. Walks each id, writes a status patch + a statusHistory
 * entry per post in a single batched commit.
 */
export async function bulkSetStatus(
  postIds: string[],
  status: PostStatus,
): Promise<{ ok: boolean; updated: number; error?: string }> {
  if (postIds.length === 0) return { ok: true, updated: 0 }
  const orgId = await getCurrentOrgId()
  const user = await getCurrentUser()
  const db = getDb()
  const batch = db.batch()
  const now = new Date().toISOString()

  for (const id of postIds) {
    const ref = db.doc(`${orgPostsPath(orgId)}/${id}`)
    batch.set(
      ref,
      { status, updatedAt: now },
      { merge: true },
    )
    batch.set(
      db.collection(orgPostStatusHistoryPath(orgId, id)).doc(),
      { from: null, to: status, userId: user.id, at: now, bulk: true },
    )
  }

  try {
    await batch.commit()
  } catch (err) {
    return {
      ok: false,
      updated: 0,
      error: err instanceof Error ? err.message : "Bulk update failed",
    }
  }
  if (status === "scheduled") {
    await recordActivationMilestone(orgId, "first_post_scheduled", user.id, { source: "bulk" })
  } else if (status === "posted") {
    await recordActivationMilestone(orgId, "first_post_published", user.id, { source: "marked_posted" })
  }
  revalidatePath("/calendar")
  revalidatePath("/posts")
  return { ok: true, updated: postIds.length }
}

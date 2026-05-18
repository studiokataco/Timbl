"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getCurrentOrgId, getCurrentUser, getDb } from "@/lib/auth/server-helpers"
import {
  awarenessDaysPath,
  orgCategoriesPath,
  orgPostsPath,
} from "@/lib/firebase/paths"
import { snapToData } from "@/lib/firebase/serialize"
import type { AwarenessDay, Post, ServerActionResult } from "@/lib/schemas"

const promoteSchema = z.object({
  awarenessDayId: z.string().min(1),
  /** Optional override — defaults to the awareness day's own date. */
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

/*
 * Promote an awareness day to a post. Pulls the suggested category if one is
 * mapped, otherwise leaves categoryId unset for the user to choose in the
 * composer.
 */
export async function promoteAwarenessDay(
  input: unknown,
): Promise<ServerActionResult> {
  const parsed = promoteSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" }
  }
  const orgId = await getCurrentOrgId()
  const user = await getCurrentUser()
  const db = getDb()

  const daySnap = await db
    .doc(`${awarenessDaysPath}/${parsed.data.awarenessDayId}`)
    .get()
  if (!daySnap.exists) return { ok: false, error: "Awareness day not found" }
  const day = snapToData<AwarenessDay>(daySnap)

  // Try to resolve the suggested category by slug (= id).
  let categoryId: string | undefined
  let category: {
    defaultPostType?: Post["postType"]
    defaultHashtags?: string[]
    defaultCtaId?: string
    defaultLeadId?: string
  } | null = null
  if (day.suggestedCategorySlug) {
    const catSnap = await db
      .doc(`${orgCategoriesPath(orgId)}/${day.suggestedCategorySlug}`)
      .get()
    if (catSnap.exists) {
      categoryId = catSnap.id
      category = snapToData(catSnap)
    }
  }

  const ref = db.collection(orgPostsPath(orgId)).doc()
  const now = new Date().toISOString()

  const doc: Post = {
    id: ref.id,
    organizationId: orgId,
    scheduledDate: parsed.data.scheduledDate ?? day.date,
    status: "idea",
    categoryId,
    awarenessDayId: day.id,
    postType: category?.defaultPostType ?? "grid",
    brief: day.name,
    detailedBrief: day.description,
    hashtags: category?.defaultHashtags ?? [],
    ctaId: category?.defaultCtaId,
    leadUserId: category?.defaultLeadId,
    assigneeId: user.id,
    assetUrls: [],
    channelStatuses: {},
    createdAt: now,
    updatedAt: now,
  }

  await ref.set(doc)
  revalidatePath("/calendar")
  revalidatePath("/awareness")
  return { ok: true, id: ref.id }
}

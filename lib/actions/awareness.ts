"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getCurrentOrgId, getCurrentUser, getDb } from "@/lib/auth/server-helpers"
import { recordActivationMilestone } from "@/lib/telemetry/activation"
import { awarenessDaysPath, orgPostsPath } from "@/lib/firebase/paths"
import { getCurrentBrandId } from "@/lib/brand/brand-session"
import { snapToData } from "@/lib/firebase/serialize"
import type { AwarenessDay, Post, ServerActionResult } from "@/lib/schemas"

const promoteSchema = z.object({
  awarenessDayId: z.string().min(1),
  /** Optional override - defaults to the awareness day's own date. */
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

  /* Category is left undefined - the user picks one explicitly from the
   * composer after promotion. (Suggested-category auto-link removed per
   * UX-test round 2.) */
  const ref = db.collection(orgPostsPath(orgId)).doc()
  const now = new Date().toISOString()

  const doc: Post = {
    id: ref.id,
    organizationId: orgId,
    brandId: await getCurrentBrandId(orgId),
    scheduledDate: parsed.data.scheduledDate ?? day.date,
    status: "idea",
    categoryId: undefined,
    awarenessDayId: day.id,
    postType: "grid",
    brief: day.name,
    detailedBrief: day.description,
    hashtags: [],
    ctaId: undefined,
    leadUserId: undefined,
    assigneeId: user.id,
    assetUrls: [],
    designLinks: [],
    channelStatuses: {},
    createdAt: now,
    updatedAt: now,
  }

  await ref.set(doc)
  revalidatePath("/calendar")
  revalidatePath("/awareness")
  await recordActivationMilestone(orgId, "first_draft_created", user.id, { source: "awareness_day" })
  return { ok: true, id: ref.id }
}

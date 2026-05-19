"use server"

import { z } from "zod"
import { randomUUID } from "node:crypto"

import { getAdminDb } from "@/lib/firebase/admin"
import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import {
  orgIdeationFeedPath,
  orgPostsPath,
} from "@/lib/firebase/paths"
import {
  ideationItemSchema,
  ideationStatus,
  type IdeationItem,
} from "@/lib/schemas/ideationItem"
import { isoDate, type ServerActionResult } from "@/lib/schemas/_shared"

const listInput = z.object({
  status: ideationStatus.optional(),
  limit: z.number().int().min(1).max(200).default(50),
})

export async function listIdeationFeed(
  input: unknown = {},
): Promise<IdeationItem[]> {
  const parsed = listInput.parse(input ?? {})
  const orgId = await getCurrentOrgId()
  let q: FirebaseFirestore.Query = getAdminDb().collection(
    orgIdeationFeedPath(orgId),
  )
  if (parsed.status) q = q.where("status", "==", parsed.status)
  q = q.orderBy("createdAt", "desc").limit(parsed.limit)
  const snap = await q.get()
  const out: IdeationItem[] = []
  for (const d of snap.docs) {
    const r = ideationItemSchema.safeParse({
      ...(d.data() ?? {}),
      id: d.id,
      organizationId: orgId,
    })
    if (r.success) out.push(r.data)
  }
  return out
}

const markInput = z.object({
  itemId: z.string().min(1),
  status: ideationStatus,
})

export async function markIdeationStatus(
  input: unknown,
): Promise<ServerActionResult> {
  const parsed = markInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  const orgId = await getCurrentOrgId()
  await getAdminDb()
    .collection(orgIdeationFeedPath(orgId))
    .doc(parsed.data.itemId)
    .set(
      {
        status: parsed.data.status,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    )
  return { ok: true, id: parsed.data.itemId }
}

const promoteInput = z.object({
  itemId: z.string().min(1),
  scheduledDate: isoDate.optional(),
  categoryId: z.string().optional(),
})

export async function promoteIdeationItem(
  input: unknown,
): Promise<ServerActionResult> {
  const parsed = promoteInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  const orgId = await getCurrentOrgId()
  const db = getAdminDb()
  const itemRef = db.collection(orgIdeationFeedPath(orgId)).doc(parsed.data.itemId)
  const snap = await itemRef.get()
  if (!snap.exists) return { ok: false, error: "not_found" }
  const item = ideationItemSchema.safeParse({
    ...(snap.data() ?? {}),
    id: parsed.data.itemId,
    organizationId: orgId,
  })
  if (!item.success) return { ok: false, error: "malformed_item" }

  const postId = randomUUID()
  const now = new Date().toISOString()
  await db
    .collection(orgPostsPath(orgId))
    .doc(postId)
    .set({
      id: postId,
      organizationId: orgId,
      scheduledDate:
        parsed.data.scheduledDate ?? item.data.suggestedDate ?? todayISO(),
      status: "idea",
      categoryId: parsed.data.categoryId ?? undefined,
      awarenessDayId: item.data.awarenessDayId ?? undefined,
      brief: item.data.title,
      detailedBrief: item.data.summary,
      hashtags: [],
      assetUrls: [],
      channelStatuses: {},
      agentMeta: {
        sourceRunId: item.data.createdByRunId,
        sourceAgent: "ideator",
        ideationItemId: parsed.data.itemId,
        reviewState: "pending",
        /* A promoted ideation produces a draft; approval moves it onto
         * the calendar at the suggested or human-picked time. */
        nextAction: {
          kind: "schedule_post" as const,
          targetTime: undefined,
          categoryId: parsed.data.categoryId ?? undefined,
        },
      },
      createdAt: now,
      updatedAt: now,
    })
  await itemRef.set(
    {
      status: "used",
      promotedPostId: postId,
      updatedAt: now,
    },
    { merge: true },
  )
  return { ok: true, id: postId }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

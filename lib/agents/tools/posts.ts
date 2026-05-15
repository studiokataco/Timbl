import { z } from "zod"
import { FunctionTool } from "@google/adk"
import { randomUUID } from "node:crypto"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgPostsPath, orgKanbanColumnsPath } from "@/lib/firebase/paths"
import { isoDate, isoTime, postType } from "@/lib/schemas/_shared"

import { getRuntimeCtx } from "../runtime/context"

/*
 * Post-manipulation tools. Each writes through the same /organizations/
 * {orgId}/posts collection the UI uses — no parallel store. Drafts the
 * agent creates carry an `agentMeta` field so the UI can render the
 * "AI-assisted" badge and the review-state pill.
 */

const channelKey = z.enum([
  "instagram",
  "facebook",
  "linkedin",
  "website",
  "fb_groups",
])

const createInput = z.object({
  scheduledDate: isoDate,
  scheduledTime: isoTime.optional(),
  categoryId: z.string().optional(),
  campaignId: z.string().optional(),
  awarenessDayId: z.string().optional(),
  ideationItemId: z.string().optional(),
  brief: z.string().min(1).max(2_000),
  detailedBrief: z.string().max(8_000).optional(),
  blurb: z.string().max(8_000).optional(),
  hashtags: z.array(z.string().min(1).max(64)).max(40).default([]),
  postType: postType.default("grid"),
  channels: z.array(channelKey).default([]),
  status: z.string().min(1).default("idea"),
  confidence: z.number().min(0).max(1).optional(),
  rationale: z.string().max(4_000).optional(),
  reviewState: z.enum(["pending", "approved", "rejected"]).default("pending"),
})

export const createDraftPostTool = new FunctionTool({
  name: "createDraftPost",
  description:
    "Create a new draft post in the org's calendar. Fields not provided will be left empty for human authors to fill in. Always include `brief` — a 1–2 sentence summary of what the post is about — and `rationale` describing why this idea fits the brand.",
  parameters: createInput,
  execute: async (input, ctx) => {
    const { orgId, runId, agentName } = getRuntimeCtx(ctx)
    const id = randomUUID()
    const now = new Date().toISOString()
    const doc = {
      id,
      organizationId: orgId,
      scheduledDate: input.scheduledDate,
      scheduledTime: input.scheduledTime,
      status: input.status,
      categoryId: input.categoryId,
      campaignId: input.campaignId,
      awarenessDayId: input.awarenessDayId,
      postType: input.postType,
      brief: input.brief,
      detailedBrief: input.detailedBrief,
      blurb: input.blurb,
      hashtags: input.hashtags,
      assetUrls: [],
      channelStatuses: Object.fromEntries(
        input.channels.map((c) => [c, "n/a"]),
      ),
      agentMeta: {
        sourceRunId: runId,
        sourceAgent: agentName,
        confidence: input.confidence,
        rationale: input.rationale,
        ideationItemId: input.ideationItemId,
        reviewState: input.reviewState,
      },
      createdAt: now,
      updatedAt: now,
    }
    await getAdminDb()
      .collection(orgPostsPath(orgId))
      .doc(id)
      .set(doc)
    return { ok: true, postId: id }
  },
})

const updateInput = z.object({
  postId: z.string().min(1),
  patch: z.object({
    scheduledDate: isoDate.optional(),
    scheduledTime: isoTime.optional(),
    status: z.string().optional(),
    categoryId: z.string().optional(),
    campaignId: z.string().optional(),
    brief: z.string().max(2_000).optional(),
    detailedBrief: z.string().max(8_000).optional(),
    blurb: z.string().max(8_000).optional(),
    hashtags: z.array(z.string()).optional(),
    rationale: z.string().max(4_000).optional(),
    reviewState: z.enum(["pending", "approved", "rejected"]).optional(),
  }),
})

export const updateDraftPostTool = new FunctionTool({
  name: "updateDraft",
  description:
    "Update an existing post (typically one the agent already created). Cross-org writes are rejected.",
  parameters: updateInput,
  execute: async (input, ctx) => {
    const { orgId } = getRuntimeCtx(ctx)
    const ref = getAdminDb().collection(orgPostsPath(orgId)).doc(input.postId)
    const snap = await ref.get()
    if (!snap.exists) {
      return { ok: false, error: "post_not_found" }
    }
    if (snap.data()?.organizationId !== orgId) {
      return { ok: false, error: "cross_org" }
    }
    const now = new Date().toISOString()
    const flat: Record<string, unknown> = { updatedAt: now }
    for (const [k, v] of Object.entries(input.patch)) {
      if (v === undefined) continue
      if (k === "rationale" || k === "reviewState") {
        flat[`agentMeta.${k}`] = v
      } else {
        flat[k] = v
      }
    }
    await ref.set(flat, { merge: true })
    return { ok: true, postId: input.postId }
  },
})

const listInput = z.object({
  status: z.string().optional(),
  fromDate: isoDate.optional(),
  toDate: isoDate.optional(),
  limit: z.number().int().min(1).max(100).default(25),
  onlyAgentDrafts: z.boolean().default(false),
})

export const listPostsTool = new FunctionTool({
  name: "listPosts",
  description:
    "List posts in the org's calendar. Use `onlyAgentDrafts: true` to scope to posts authored by an agent. Returns up to `limit` posts ordered by scheduled date ascending.",
  parameters: listInput,
  execute: async (input, ctx) => {
    const { orgId } = getRuntimeCtx(ctx)
    let q: FirebaseFirestore.Query = getAdminDb().collection(
      orgPostsPath(orgId),
    )
    if (input.status) q = q.where("status", "==", input.status)
    if (input.fromDate) q = q.where("scheduledDate", ">=", input.fromDate)
    if (input.toDate) q = q.where("scheduledDate", "<=", input.toDate)
    q = q.orderBy("scheduledDate", "asc").limit(input.limit)
    const snap = await q.get()
    const posts = snap.docs
      .map((d) => d.data())
      .filter((p) =>
        input.onlyAgentDrafts ? p.agentMeta !== undefined : true,
      )
      .map((p) => ({
        id: p.id,
        scheduledDate: p.scheduledDate,
        scheduledTime: p.scheduledTime ?? null,
        status: p.status,
        brief: p.brief ?? null,
        blurb: p.blurb ?? null,
        categoryId: p.categoryId ?? null,
        campaignId: p.campaignId ?? null,
        agentMeta: p.agentMeta ?? null,
      }))
    return { count: posts.length, posts }
  },
})

const moveInput = z.object({
  postId: z.string().min(1),
  toColumnId: z.string().min(1),
})

export const movePostToColumnTool = new FunctionTool({
  name: "movePostToColumn",
  description:
    "Move a post to a different kanban column (i.e. change its status). The columnId must reference a real /kanbanColumns/{id} doc in the same org.",
  parameters: moveInput,
  execute: async (input, ctx) => {
    const { orgId } = getRuntimeCtx(ctx)
    const db = getAdminDb()
    const columnRef = db
      .collection(orgKanbanColumnsPath(orgId))
      .doc(input.toColumnId)
    const colSnap = await columnRef.get()
    if (!colSnap.exists) return { ok: false, error: "column_not_found" }

    const postRef = db.collection(orgPostsPath(orgId)).doc(input.postId)
    const postSnap = await postRef.get()
    if (!postSnap.exists) return { ok: false, error: "post_not_found" }
    if (postSnap.data()?.organizationId !== orgId) {
      return { ok: false, error: "cross_org" }
    }
    await postRef.set(
      { status: input.toColumnId, updatedAt: new Date().toISOString() },
      { merge: true },
    )
    return { ok: true }
  },
})

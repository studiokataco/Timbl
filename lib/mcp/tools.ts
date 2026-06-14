import "server-only"

import { z } from "zod"

import { getAdminDb } from "@/lib/firebase/admin"
import {
  orgPostsPath,
  orgIdeationFeedPath,
  orgPublishRunsPath,
} from "@/lib/firebase/paths"
import { snapToData } from "@/lib/firebase/serialize"
import { requireScope } from "@/lib/auth/public-scopes"
import type { PublicCaller } from "@/lib/api/public-middleware"

function zs(schema: z.ZodTypeAny): unknown {
  const json = z.toJSONSchema(schema) as Record<string, unknown>
  delete json.$schema
  return json
}

export interface McpTool {
  name: string
  description: string
  inputSchema: unknown
}

const listPostsInput = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
  status: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
})

const getPostInput = z.object({
  id: z.string().min(1),
})

const createPostInput = z.object({
  scheduledDate: z.string().min(1),
  brief: z.string().optional(),
  status: z.string().default("draft"),
  categoryId: z.string().optional(),
})

const updatePostInput = z.object({
  id: z.string().min(1),
  patch: z.object({
    scheduledDate: z.string().optional(),
    brief: z.string().optional(),
    status: z.string().optional(),
    blurb: z.string().optional(),
  }),
})

const schedulePostInput = z.object({
  id: z.string().min(1),
  scheduledDate: z.string().optional(),
})

const listIdeasInput = z.object({
  status: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
})

const createIdeaInput = z.object({
  title: z.string().min(1),
  summary: z.string().optional(),
})

const promoteIdeaInput = z.object({
  id: z.string().min(1),
  scheduledDate: z.string().optional(),
})

const requestApprovalInput = z.object({
  postId: z.string().min(1),
  summary: z.string().optional(),
})

const getMetricsInput = z.object({
  start: z.string().min(1),
  end: z.string().min(1),
})

export function getMcpTools(): McpTool[] {
  return [
    {
      name: "list_posts",
      description: "List scheduled posts for the workspace, optionally filtered by date range and status.",
      inputSchema: zs(listPostsInput),
    },
    {
      name: "get_post",
      description: "Fetch a single post by id.",
      inputSchema: zs(getPostInput),
    },
    {
      name: "create_post",
      description: "Create a new draft post.",
      inputSchema: zs(createPostInput),
    },
    {
      name: "update_post",
      description: "Apply a partial patch to an existing post.",
      inputSchema: zs(updatePostInput),
    },
    {
      name: "schedule_post",
      description: "Mark a post as scheduled, optionally setting its scheduled date.",
      inputSchema: zs(schedulePostInput),
    },
    {
      name: "list_ideas",
      description: "List ideation feed items, optionally filtered by status.",
      inputSchema: zs(listIdeasInput),
    },
    {
      name: "create_idea",
      description: "Add a new idea to the ideation feed.",
      inputSchema: zs(createIdeaInput),
    },
    {
      name: "promote_idea",
      description: "Promote an idea to a draft post and mark the idea as used.",
      inputSchema: zs(promoteIdeaInput),
    },
    {
      name: "request_approval",
      description: "Flag a post for human review by setting its review state to pending.",
      inputSchema: zs(requestApprovalInput),
    },
    {
      name: "get_metrics",
      description: "Return publish run counts (total / successful / failed) for a date range.",
      inputSchema: zs(getMetricsInput),
    },
  ]
}

export type McpToolResult = Record<string, unknown>

export async function callMcpTool(
  caller: PublicCaller,
  name: string,
  args: unknown,
): Promise<McpToolResult> {
  const db = getAdminDb()

  switch (name) {
    case "list_posts": {
      requireScope(caller.scopes, "posts:read")
      const { start, end, status, limit } = listPostsInput.parse(args)
      let q = db.collection(orgPostsPath(caller.orgId)) as FirebaseFirestore.Query
      if (status) q = q.where("status", "==", status)
      if (start) q = q.where("scheduledDate", ">=", start)
      if (end) q = q.where("scheduledDate", "<=", end)
      q = q.orderBy("scheduledDate", "desc").limit(limit)
      const snap = await q.get()
      return { posts: snap.docs.map((d) => snapToData(d)) }
    }

    case "get_post": {
      requireScope(caller.scopes, "posts:read")
      const { id } = getPostInput.parse(args)
      const snap = await db.doc(`${orgPostsPath(caller.orgId)}/${id}`).get()
      if (!snap.exists) throw Object.assign(new Error("Post not found"), { code: "not_found" })
      return { post: snapToData(snap) }
    }

    case "create_post": {
      requireScope(caller.scopes, "posts:write")
      const { scheduledDate, brief, status, categoryId } = createPostInput.parse(args)
      const ref = db.collection(orgPostsPath(caller.orgId)).doc()
      const now = new Date().toISOString()
      const doc: Record<string, unknown> = {
        id: ref.id,
        organizationId: caller.orgId,
        scheduledDate,
        status,
        createdAt: now,
        updatedAt: now,
        hashtags: [],
        assetUrls: [],
        channelStatuses: {},
        agentMeta: { reviewState: "none" },
      }
      if (brief !== undefined) doc.brief = brief
      if (categoryId !== undefined) doc.categoryId = categoryId
      await ref.set(doc)
      return { post: doc }
    }

    case "update_post": {
      requireScope(caller.scopes, "posts:write")
      const { id, patch } = updatePostInput.parse(args)
      const ref = db.doc(`${orgPostsPath(caller.orgId)}/${id}`)
      if (!(await ref.get()).exists) throw Object.assign(new Error("Post not found"), { code: "not_found" })
      await ref.set({ ...patch, updatedAt: new Date().toISOString() }, { merge: true })
      return { ok: true }
    }

    case "schedule_post": {
      requireScope(caller.scopes, "posts:write")
      const { id, scheduledDate } = schedulePostInput.parse(args)
      const ref = db.doc(`${orgPostsPath(caller.orgId)}/${id}`)
      if (!(await ref.get()).exists) throw Object.assign(new Error("Post not found"), { code: "not_found" })
      const update: Record<string, unknown> = { status: "scheduled", updatedAt: new Date().toISOString() }
      if (scheduledDate !== undefined) update.scheduledDate = scheduledDate
      await ref.set(update, { merge: true })
      return { ok: true }
    }

    case "list_ideas": {
      requireScope(caller.scopes, "ideation:read")
      const { status, limit } = listIdeasInput.parse(args)
      let q = db.collection(orgIdeationFeedPath(caller.orgId)) as FirebaseFirestore.Query
      if (status) q = q.where("status", "==", status)
      q = q.orderBy("createdAt", "desc").limit(limit)
      const snap = await q.get()
      return { items: snap.docs.map((d) => snapToData(d)) }
    }

    case "create_idea": {
      requireScope(caller.scopes, "ideation:write")
      const { title, summary } = createIdeaInput.parse(args)
      const ref = db.collection(orgIdeationFeedPath(caller.orgId)).doc()
      const now = new Date().toISOString()
      const doc: Record<string, unknown> = {
        id: ref.id,
        organizationId: caller.orgId,
        title,
        status: "new",
        createdAt: now,
        updatedAt: now,
      }
      if (summary !== undefined) doc.summary = summary
      await ref.set(doc)
      return { item: doc }
    }

    case "promote_idea": {
      requireScope(caller.scopes, "ideation:write")
      const { id, scheduledDate } = promoteIdeaInput.parse(args)
      const itemRef = db.collection(orgIdeationFeedPath(caller.orgId)).doc(id)
      const snap = await itemRef.get()
      if (!snap.exists) throw Object.assign(new Error("Idea not found"), { code: "not_found" })
      const item = snap.data()!
      const postRef = db.collection(orgPostsPath(caller.orgId)).doc()
      const now = new Date().toISOString()
      await Promise.all([
        postRef.set({
          id: postRef.id,
          organizationId: caller.orgId,
          brief: item.title,
          detailedBrief: item.summary,
          scheduledDate: scheduledDate ?? now.slice(0, 10),
          status: "idea",
          hashtags: [],
          assetUrls: [],
          channelStatuses: {},
          agentMeta: {
            sourceRunId: item.createdByRunId ?? "",
            sourceAgent: "ideator",
            ideationItemId: id,
            reviewState: "pending",
          },
          createdAt: now,
          updatedAt: now,
        }),
        itemRef.set({ status: "used", promotedPostId: postRef.id, updatedAt: now }, { merge: true }),
      ])
      return { postId: postRef.id }
    }

    case "request_approval": {
      requireScope(caller.scopes, "approvals:request")
      const { postId } = requestApprovalInput.parse(args)
      const ref = db.doc(`${orgPostsPath(caller.orgId)}/${postId}`)
      if (!(await ref.get()).exists) throw Object.assign(new Error("Post not found"), { code: "not_found" })
      await ref.update({ "agentMeta.reviewState": "pending", updatedAt: new Date().toISOString() })
      return { ok: true, status: "pending", message: "Approval requested" }
    }

    case "get_metrics": {
      requireScope(caller.scopes, "metrics:read")
      const { start, end } = getMetricsInput.parse(args)
      const snap = await db
        .collection(orgPublishRunsPath(caller.orgId))
        .where("startedAt", ">=", start)
        .where("startedAt", "<=", end)
        .orderBy("startedAt", "desc")
        .limit(200)
        .get()
      const runs = snap.docs.map((d) => snapToData(d)) as Array<Record<string, unknown>>
      const total = runs.length
      const successful = runs.filter((r) => r.status === "completed").length
      return { total, successful, failed: total - successful }
    }

    default:
      throw Object.assign(new Error(`Unknown tool: ${name}`), { code: "unknown_tool" })
  }
}

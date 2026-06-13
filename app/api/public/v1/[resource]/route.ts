import type { NextRequest } from "next/server"
import { z } from "zod"

import { getAdminDb } from "@/lib/firebase/admin"
import {
  orgPostsPath,
  orgCategoriesPath,
  orgSocialAccountsPath,
  orgIdeationFeedPath,
  orgPublishRunsPath,
  orgWebhookSubscriptionsPath,
} from "@/lib/firebase/paths"
import { snapToData } from "@/lib/firebase/serialize"
import {
  resolvePublicCaller,
  scopeCheck,
  authResponse,
  apiError,
  type PublicCaller,
} from "@/lib/api/public-middleware"
import { writePublicAudit, type PublicAuditKind } from "@/lib/telemetry/public-audit"
import { postSchema } from "@/lib/schemas/post"
import { ideationItemSchema } from "@/lib/schemas/ideationItem"
import { randomBytes } from "node:crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Handler = (
  caller: PublicCaller,
  body: Record<string, unknown>,
  params: Record<string, string>,
) => Promise<Response>

const handlers: Record<string, Record<string, Handler>> = {
  posts: {
    list: async (caller, body) => {
      scopeCheck(caller, "posts:read")
      const { start, end, status, limit = 50 } = body
      let q = getAdminDb().collection(orgPostsPath(caller.orgId)) as FirebaseFirestore.Query
      if (status) q = q.where("status", "==", status)
      if (start) q = q.where("scheduledDate", ">=", start)
      if (end) q = q.where("scheduledDate", "<=", end)
      q = q.orderBy("scheduledDate", "desc").limit(Number(limit))
      const snap = await q.get()
      return Response.json({ posts: snap.docs.map((d) => snapToData(d)) })
    },

    get: async (caller, body) => {
      const deny = scopeCheck(caller, "posts:read")
      if (deny) return deny
      const id = z.string().min(1).safeParse(body.id)
      if (!id.success) return apiError("invalid_id", 400)
      const snap = await getAdminDb().doc(`${orgPostsPath(caller.orgId)}/${id.data}`).get()
      if (!snap.exists) return apiError("not_found", 404)
      return Response.json({ post: snapToData(snap) })
    },

    create: async (caller, body) => {
      const deny = scopeCheck(caller, "posts:write")
      if (deny) return deny
      const parsed = postSchema.partial().extend({ scheduledDate: z.string() }).safeParse(body)
      if (!parsed.success) return apiError("invalid_body", 400, parsed.error.issues[0]?.message)
      const db = getAdminDb()
      const ref = db.collection(orgPostsPath(caller.orgId)).doc()
      const now = new Date().toISOString()
      const doc = { ...parsed.data, id: ref.id, organizationId: caller.orgId, createdAt: now, updatedAt: now }
      await ref.set(doc)
      return Response.json({ post: doc }, { status: 201 })
    },

    update: async (caller, body) => {
      const deny = scopeCheck(caller, "posts:write")
      if (deny) return deny
      const id = z.string().min(1).safeParse(body.id)
      if (!id.success) return apiError("invalid_id", 400)
      const ref = getAdminDb().doc(`${orgPostsPath(caller.orgId)}/${id.data}`)
      const snap = await ref.get()
      if (!snap.exists) return apiError("not_found", 404)
      const { id: bodyId, ...rest } = body
      void bodyId
      await ref.set({ ...rest, updatedAt: new Date().toISOString() }, { merge: true })
      return Response.json({ ok: true })
    },

    edit: async (caller, body) => {
      const deny = scopeCheck(caller, "posts:write")
      if (deny) return deny
      const id = z.string().min(1).safeParse(body.id)
      if (!id.success) return apiError("invalid_id", 400)
      const ref = getAdminDb().doc(`${orgPostsPath(caller.orgId)}/${id.data}`)
      const snap = await ref.get()
      if (!snap.exists) return apiError("not_found", 404)
      if (!["scheduled", "draft"].includes(snap.data()?.status)) return apiError("invalid_state", 409)
      const { id: bodyId2, ...rest } = body
      void bodyId2
      await ref.set({ ...rest, updatedAt: new Date().toISOString() }, { merge: true })
      return Response.json({ ok: true })
    },

    delete: async (caller, body) => {
      const deny = scopeCheck(caller, "posts:write")
      if (deny) return deny
      const id = z.string().min(1).safeParse(body.id)
      if (!id.success) return apiError("invalid_id", 400)
      const ref = getAdminDb().doc(`${orgPostsPath(caller.orgId)}/${id.data}`)
      if (!(await ref.get()).exists) return apiError("not_found", 404)
      await ref.delete()
      return Response.json({ ok: true })
    },

    schedule: async (caller, body) => {
      const deny = scopeCheck(caller, "posts:write")
      if (deny) return deny
      const id = z.string().min(1).safeParse(body.id)
      if (!id.success) return apiError("invalid_id", 400)
      const ref = getAdminDb().doc(`${orgPostsPath(caller.orgId)}/${id.data}`)
      if (!(await ref.get()).exists) return apiError("not_found", 404)
      await ref.set({ status: "scheduled", scheduledDate: body.scheduledDate ?? undefined, scheduledTime: body.scheduledTime ?? undefined, updatedAt: new Date().toISOString() }, { merge: true })
      return Response.json({ ok: true })
    },

    unschedule: async (caller, body) => {
      const deny = scopeCheck(caller, "posts:write")
      if (deny) return deny
      const id = z.string().min(1).safeParse(body.id)
      if (!id.success) return apiError("invalid_id", 400)
      const ref = getAdminDb().doc(`${orgPostsPath(caller.orgId)}/${id.data}`)
      if (!(await ref.get()).exists) return apiError("not_found", 404)
      await ref.set({ status: "draft", updatedAt: new Date().toISOString() }, { merge: true })
      return Response.json({ ok: true })
    },

    publish_now: async (caller, body) => {
      const deny = scopeCheck(caller, "posts:publish")
      if (deny) return deny
      const id = z.string().min(1).safeParse(body.id)
      if (!id.success) return apiError("invalid_id", 400)
      const ref = getAdminDb().doc(`${orgPostsPath(caller.orgId)}/${id.data}`)
      if (!(await ref.get()).exists) return apiError("not_found", 404)
      await ref.set({ status: "posted", postedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true })
      return Response.json({ ok: true })
    },
  },

  ideation: {
    list: async (caller, body) => {
      const deny = scopeCheck(caller, "ideation:read")
      if (deny) return deny
      let q = getAdminDb().collection(orgIdeationFeedPath(caller.orgId)) as FirebaseFirestore.Query
      if (body.status) q = q.where("status", "==", body.status)
      q = q.orderBy("createdAt", "desc").limit(Number(body.limit ?? 50))
      const snap = await q.get()
      return Response.json({ items: snap.docs.map((d) => snapToData(d)) })
    },

    create: async (caller, body) => {
      const deny = scopeCheck(caller, "ideation:write")
      if (deny) return deny
      const parsed = ideationItemSchema.partial().extend({ title: z.string().min(1) }).safeParse(body)
      if (!parsed.success) return apiError("invalid_body", 400, parsed.error.issues[0]?.message)
      const db = getAdminDb()
      const ref = db.collection(orgIdeationFeedPath(caller.orgId)).doc()
      const now = new Date().toISOString()
      const doc = { ...parsed.data, id: ref.id, organizationId: caller.orgId, status: "new", createdAt: now, updatedAt: now }
      await ref.set(doc)
      return Response.json({ item: doc }, { status: 201 })
    },

    promote: async (caller, body) => {
      const deny = scopeCheck(caller, "ideation:write")
      if (deny) return deny
      const id = z.string().min(1).safeParse(body.id)
      if (!id.success) return apiError("invalid_id", 400)
      const db = getAdminDb()
      const itemRef = db.collection(orgIdeationFeedPath(caller.orgId)).doc(id.data)
      const snap = await itemRef.get()
      if (!snap.exists) return apiError("not_found", 404)
      const item = snap.data()!
      const postRef = db.collection(orgPostsPath(caller.orgId)).doc()
      const now = new Date().toISOString()
      await Promise.all([
        postRef.set({ id: postRef.id, organizationId: caller.orgId, brief: item.title, detailedBrief: item.summary, scheduledDate: body.scheduledDate ?? now.slice(0, 10), status: "idea", hashtags: [], assetUrls: [], channelStatuses: {}, agentMeta: { sourceRunId: item.createdByRunId ?? "", sourceAgent: "ideator", ideationItemId: id.data, reviewState: "pending" }, createdAt: now, updatedAt: now }),
        itemRef.set({ status: "used", promotedPostId: postRef.id, updatedAt: now }, { merge: true }),
      ])
      return Response.json({ postId: postRef.id })
    },
  },

  approvals: {
    list: async (caller) => {
      const deny = scopeCheck(caller, "approvals:read")
      if (deny) return deny
      const snap = await getAdminDb()
        .collection(orgPostsPath(caller.orgId))
        .where("agentMeta.reviewState", "==", "pending")
        .orderBy("createdAt", "desc")
        .limit(50)
        .get()
      return Response.json({ items: snap.docs.map((d) => snapToData(d)) })
    },

    request: async (caller, body) => {
      const deny = scopeCheck(caller, "approvals:request")
      if (deny) return deny
      const id = z.string().min(1).safeParse(body.postId)
      if (!id.success) return apiError("invalid_id", 400)
      const ref = getAdminDb().doc(`${orgPostsPath(caller.orgId)}/${id.data}`)
      if (!(await ref.get()).exists) return apiError("not_found", 404)
      await ref.set({ "agentMeta.reviewState": "pending", updatedAt: new Date().toISOString() }, { merge: true })
      return Response.json({ ok: true })
    },

    decide: async (caller, body) => {
      const deny = scopeCheck(caller, "approvals:request")
      if (deny) return deny
      const schema = z.object({ postId: z.string(), approved: z.boolean(), feedback: z.string().optional() })
      const parsed = schema.safeParse(body)
      if (!parsed.success) return apiError("invalid_body", 400)
      const ref = getAdminDb().doc(`${orgPostsPath(caller.orgId)}/${parsed.data.postId}`)
      if (!(await ref.get()).exists) return apiError("not_found", 404)
      await ref.set({ "agentMeta.reviewState": parsed.data.approved ? "approved" : "rejected", updatedAt: new Date().toISOString() }, { merge: true })
      return Response.json({ ok: true })
    },
  },

  categories: {
    list: async (caller) => {
      const deny = scopeCheck(caller, "categories:read")
      if (deny) return deny
      const snap = await getAdminDb()
        .collection(orgCategoriesPath(caller.orgId))
        .where("isActive", "==", true)
        .orderBy("displayOrder", "asc")
        .get()
      return Response.json({ categories: snap.docs.map((d) => snapToData(d)) })
    },
  },

  channels: {
    list: async (caller) => {
      const deny = scopeCheck(caller, "channels:read")
      if (deny) return deny
      const snap = await getAdminDb()
        .collection(orgSocialAccountsPath(caller.orgId))
        .where("status", "in", ["active", "needs_reauth"])
        .get()
      return Response.json({ channels: snap.docs.map((d) => snapToData(d)) })
    },

    get: async (caller, body) => {
      const deny = scopeCheck(caller, "channels:read")
      if (deny) return deny
      const id = z.string().min(1).safeParse(body.id)
      if (!id.success) return apiError("invalid_id", 400)
      const snap = await getAdminDb().doc(`${orgSocialAccountsPath(caller.orgId)}/${id.data}`).get()
      if (!snap.exists) return apiError("not_found", 404)
      return Response.json({ channel: snapToData(snap) })
    },
  },

  metrics: {
    window: async (caller, body) => {
      const deny = scopeCheck(caller, "metrics:read")
      if (deny) return deny
      const { start, end } = z.object({ start: z.string(), end: z.string() }).parse(body)
      const snap = await getAdminDb()
        .collection(orgPublishRunsPath(caller.orgId))
        .where("startedAt", ">=", start)
        .where("startedAt", "<=", end)
        .orderBy("startedAt", "desc")
        .limit(200)
        .get()
      const runs = snap.docs.map((d) => snapToData(d))
      const total = runs.length
      const successful = runs.filter((r: Record<string, unknown>) => r.status === "completed").length
      return Response.json({ total, successful, failed: total - successful, runs })
    },
  },

  webhooks: {
    subscribe: async (caller, body) => {
      const deny = scopeCheck(caller, "webhooks:write")
      if (deny) return deny
      const schema = z.object({ url: z.string().url(), events: z.array(z.string()).min(1) })
      const parsed = schema.safeParse(body)
      if (!parsed.success) return apiError("invalid_body", 400)
      const db = getAdminDb()
      const ref = db.collection(orgWebhookSubscriptionsPath(caller.orgId)).doc()
      const secret = randomBytes(32).toString("hex")
      const now = new Date().toISOString()
      await ref.set({ id: ref.id, organizationId: caller.orgId, appId: caller.appId, url: parsed.data.url, events: parsed.data.events, secret, createdAt: now, updatedAt: now })
      return Response.json({ subscriptionId: ref.id, secret }, { status: 201 })
    },

    list: async (caller) => {
      const deny = scopeCheck(caller, "webhooks:write")
      if (deny) return deny
      const snap = await getAdminDb()
        .collection(orgWebhookSubscriptionsPath(caller.orgId))
        .where("appId", "==", caller.appId)
        .get()
      return Response.json({ subscriptions: snap.docs.map((d) => { const row = snapToData<Record<string, unknown>>(d); delete row.secret; return row }) })
    },
  },
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ resource: string }> },
) {
  const start = Date.now()
  const { resource } = await params

  const authResult = await resolvePublicCaller(req.headers.get("authorization"))
  if ("error" in authResult) return authResponse(authResult.error, authResult.status)
  const { caller } = authResult

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return apiError("invalid_json", 400)
  }

  const verb = z.string().min(1).safeParse(body.verb)
  if (!verb.success) return apiError("missing_verb", 400)

  const group = handlers[resource]
  if (!group) return apiError("unknown_resource", 404)
  const handler = group[verb.data]
  if (!handler) return apiError("unknown_verb", 404)

  let response: Response
  let success = true
  let errorCode: string | undefined
  try {
    response = await handler(caller, body, { resource })
    if (!response.ok) { success = false; errorCode = String(response.status) }
  } catch (err) {
    success = false
    errorCode = "internal_error"
    console.error(`[public-api] ${resource}.${verb.data}:`, err)
    response = apiError("internal_error", 500)
  }

  void writePublicAudit({
    orgId: caller.orgId,
    kind: `${resource}.${verb.data}` as PublicAuditKind,
    appId: caller.appId,
    subjectUserId: caller.subjectUserId,
    latencyMs: Date.now() - start,
    success,
    errorCode,
  })

  return response
}


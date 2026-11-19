"use server"

import { FieldPath, FieldValue } from "firebase-admin/firestore"
import { z } from "zod"
import { getCurrentOrgId, getCurrentUser, getDb } from "@/lib/auth/server-helpers"
import { orgAssistantThreadDocPath, orgAssistantThreadsPath } from "@/lib/firebase/paths"
import {
  assistantThreadEntrySchema,
  assistantThreadPatchSchema,
  assistantThreadSchema,
  shellRunSchema,
  type AssistantThread,
  type AssistantThreadEntry,
  type AssistantThreadListItem,
} from "@/lib/schemas/assistantThread"
import type { ServerActionResult } from "@/lib/schemas"
import { SHELL_THREAD_ID } from "@/lib/constants/timbl"

const saveSchema = z.object({
  id: z.string().min(1).default(SHELL_THREAD_ID),
  title: z.string().max(120).optional(),
  sessionId: z.string().min(1).max(100).optional(),
  transcript: z.array(assistantThreadEntrySchema).optional(),
  skippedPostIds: z.array(z.string()).max(200).optional(),
  run: shellRunSchema.nullable().optional(),
  idbMigratedAt: z.string().datetime({ offset: true }).optional(),
})

const threadIdSchema = z.string().min(1).max(100)

type Viewer = { id: string; role: string }
type AccessFields = { ownerId?: string; visibility?: string }

const TITLE_MAX = 60
const LIST_FIELDS = [
  "title",
  "autoTitle",
  "ownerId",
  "visibility",
  "pinnedBy",
  "archivedAt",
  "readAt",
  "run.status",
  "lastMessageAt",
  "lastAssistantAt",
  "updatedAt",
]

function canSee(doc: AccessFields | undefined, viewer: Viewer): boolean {
  if (!doc) return true
  return !doc.ownerId || doc.ownerId === viewer.id || doc.visibility === "workspace"
}

function canManage(doc: AccessFields, viewer: Viewer): boolean {
  if (doc.ownerId) return doc.ownerId === viewer.id
  return viewer.role === "admin" || viewer.role === "editor"
}

function titleFrom(text: string | undefined): string | undefined {
  const clean = (text ?? "").replace(/\s+/g, " ").trim()
  if (!clean) return undefined
  const capped = clean.length > TITLE_MAX ? `${clean.slice(0, TITLE_MAX - 3).trimEnd()}...` : clean
  return capped.charAt(0).toUpperCase() + capped.slice(1)
}

function derivedFields(transcript: AssistantThreadEntry[]) {
  let lastMessageAt = 0
  let lastAssistantAt = 0
  for (const entry of transcript) {
    lastMessageAt = Math.max(lastMessageAt, entry.createdAt)
    if (entry.role === "assistant") lastAssistantAt = Math.max(lastAssistantAt, entry.createdAt)
  }
  const autoTitle = titleFrom(transcript.find((entry) => entry.role === "user" && entry.text?.trim())?.text)
  return {
    ...(lastMessageAt ? { lastMessageAt } : {}),
    ...(lastAssistantAt ? { lastAssistantAt } : {}),
    ...(autoTitle ? { autoTitle } : {}),
  }
}

function parseThread(id: string, orgId: string, data: Record<string, unknown> | undefined): AssistantThread {
  return assistantThreadSchema.parse({
    id,
    organizationId: orgId,
    transcript: [],
    ...(data ?? {}),
  })
}

async function context() {
  const [orgId, user] = await Promise.all([getCurrentOrgId(), getCurrentUser()])
  return { orgId, viewer: { id: user.id, role: user.role } satisfies Viewer }
}

export async function fetchAssistantThread(
  threadId = SHELL_THREAD_ID,
): Promise<AssistantThread> {
  const { orgId, viewer } = await context()
  const snap = await getDb().doc(orgAssistantThreadDocPath(orgId, threadIdSchema.parse(threadId))).get()
  const data = snap.data() as Record<string, unknown> | undefined
  if (data && !canSee(data as AccessFields, viewer)) return parseThread(threadId, orgId, undefined)
  return parseThread(threadId, orgId, data)
}

export async function getAssistantThreadAccess(threadId: string): Promise<"missing" | "visible" | "private"> {
  const { orgId, viewer } = await context()
  const snap = await getDb().doc(orgAssistantThreadDocPath(orgId, threadIdSchema.parse(threadId))).get()
  if (!snap.exists) return "missing"
  return canSee(snap.data() as AccessFields, viewer) ? "visible" : "private"
}

export async function saveAssistantThread(
  input: unknown,
): Promise<ServerActionResult & { thread?: AssistantThread }> {
  const parsed = saveSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" }
  }
  const { orgId, viewer } = await context()
  const now = new Date().toISOString()
  const id = parsed.data.id
  const ref = getDb().doc(orgAssistantThreadDocPath(orgId, id))
  const prev = await ref.get()
  const prevData = prev.data() as (Record<string, unknown> & AccessFields) | undefined
  if (prevData && !canSee(prevData, viewer)) return { ok: false, error: "This chat is private" }
  const body = {
    organizationId: orgId,
    updatedAt: now,
    createdAt: prevData?.createdAt ?? now,
    ...(prev.exists ? {} : { ownerId: viewer.id, visibility: "private" }),
    ...(parsed.data.transcript ? { transcript: parsed.data.transcript, ...derivedFields(parsed.data.transcript) } : {}),
    ...(parsed.data.skippedPostIds ? { skippedPostIds: parsed.data.skippedPostIds } : {}),
    ...(parsed.data.run !== undefined ? { run: parsed.data.run } : {}),
    ...(parsed.data.title ? { title: parsed.data.title } : {}),
    ...(parsed.data.sessionId ? { sessionId: parsed.data.sessionId } : {}),
    ...(parsed.data.idbMigratedAt ? { idbMigratedAt: parsed.data.idbMigratedAt } : {}),
  }
  await ref.set(body, { merge: true })
  return { ok: true, thread: parseThread(id, orgId, { ...prevData, ...body }) }
}

export async function appendAssistantEntries(
  entries: AssistantThreadEntry[],
  threadId = SHELL_THREAD_ID,
): Promise<ServerActionResult> {
  if (entries.length === 0) return { ok: true }
  const { orgId, viewer } = await context()
  const ref = getDb().doc(orgAssistantThreadDocPath(orgId, threadIdSchema.parse(threadId)))
  const snap = await ref.get()
  const data = snap.data() as (Record<string, unknown> & AccessFields) | undefined
  if (data && !canSee(data, viewer)) return { ok: false, error: "This chat is private" }
  const current = parseThread(threadId, orgId, data)
  const seen = new Set(current.transcript.map((entry) => entry.id))
  const transcript = [
    ...current.transcript,
    ...entries.filter((entry) => !seen.has(entry.id)),
  ]
  const now = new Date().toISOString()
  await ref.set(
    {
      organizationId: orgId,
      transcript,
      ...derivedFields(transcript),
      updatedAt: now,
      createdAt: current.createdAt ?? now,
      ...(snap.exists ? {} : { ownerId: viewer.id, visibility: "private" }),
    },
    { merge: true },
  )
  return { ok: true }
}

type ListDoc = AccessFields & {
  title?: string
  autoTitle?: string
  pinnedBy?: string[]
  archivedAt?: string
  readAt?: Record<string, number>
  run?: { status?: string } | null
  lastMessageAt?: number
  lastAssistantAt?: number
  updatedAt?: string
}

export async function listAssistantThreads(): Promise<AssistantThreadListItem[]> {
  const { orgId, viewer } = await context()
  const threads = getDb().collection(orgAssistantThreadsPath(orgId))
  const [owned, shared] = await Promise.all([
    threads.where("ownerId", "==", viewer.id).select(...LIST_FIELDS).get(),
    threads.where("visibility", "==", "workspace").select(...LIST_FIELDS).get(),
  ])
  const byId = new Map<string, ListDoc>()
  for (const snap of [...owned.docs, ...shared.docs]) byId.set(snap.id, snap.data() as ListDoc)

  const rows: AssistantThreadListItem[] = []
  for (const [id, doc] of byId) {
    if (!doc.lastMessageAt && !doc.title && !doc.autoTitle) continue
    const readAt = doc.readAt?.[viewer.id]
    rows.push({
      id,
      title: doc.title ?? doc.autoTitle ?? (id === SHELL_THREAD_ID ? "Earlier chat" : "New chat"),
      lastAt: doc.lastMessageAt ?? (Date.parse(doc.updatedAt ?? "") || 0),
      mine: doc.ownerId === viewer.id,
      visibility: doc.visibility === "workspace" ? "workspace" : "private",
      pinned: Boolean(doc.pinnedBy?.includes(viewer.id)),
      archived: Boolean(doc.archivedAt),
      unread: readAt !== undefined && (doc.lastAssistantAt ?? 0) > readAt,
      needsYou: doc.run?.status === "needs_you",
      running: doc.run?.status === "running",
    })
  }
  return rows.sort((a, b) => b.lastAt - a.lastAt)
}

export async function updateAssistantThread(threadId: string, input: unknown): Promise<ServerActionResult> {
  const patch = assistantThreadPatchSchema.safeParse(input)
  if (!patch.success) return { ok: false, error: patch.error.issues[0]?.message ?? "Invalid" }
  const id = threadIdSchema.safeParse(threadId)
  if (!id.success) return { ok: false, error: "Invalid chat" }
  const { orgId, viewer } = await context()
  const ref = getDb().doc(orgAssistantThreadDocPath(orgId, id.data))
  const snap = await ref.get()
  if (!snap.exists) return patch.data.read ? { ok: true } : { ok: false, error: "This chat has no messages yet" }
  const doc = snap.data() as AccessFields
  if (!canSee(doc, viewer)) return { ok: false, error: "This chat is private" }

  const { title, pinned, archived, visibility, read } = patch.data
  const ownerChange = title !== undefined || archived !== undefined || visibility !== undefined
  if (ownerChange && !canManage(doc, viewer)) {
    return { ok: false, error: "Only the person who started this chat can change it" }
  }

  const data: Record<string, unknown> = {}
  if (title !== undefined) Object.assign(data, { title, titleSource: "user" })
  if (pinned !== undefined) data.pinnedBy = pinned ? FieldValue.arrayUnion(viewer.id) : FieldValue.arrayRemove(viewer.id)
  if (archived !== undefined) data.archivedAt = archived ? new Date().toISOString() : FieldValue.delete()
  if (visibility !== undefined) data.visibility = visibility
  if (Object.keys(data).length) await ref.update(data)
  if (read) await ref.update(new FieldPath("readAt", viewer.id), Date.now())
  return { ok: true }
}

export async function deleteAssistantThread(threadId: string): Promise<ServerActionResult> {
  const id = threadIdSchema.safeParse(threadId)
  if (!id.success) return { ok: false, error: "Invalid chat" }
  const { orgId, viewer } = await context()
  const ref = getDb().doc(orgAssistantThreadDocPath(orgId, id.data))
  const snap = await ref.get()
  if (!snap.exists) return { ok: true }
  if (!canManage(snap.data() as AccessFields, viewer)) {
    return { ok: false, error: "Only the person who started this chat can delete it" }
  }
  await ref.delete()
  return { ok: true }
}

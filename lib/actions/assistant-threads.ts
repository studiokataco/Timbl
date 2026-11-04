"use server"

import { z } from "zod"
import { getCurrentOrgId, getDb } from "@/lib/auth/server-helpers"
import { orgAssistantThreadDocPath } from "@/lib/firebase/paths"
import {
  assistantThreadEntrySchema,
  assistantThreadSchema,
  type AssistantThread,
  type AssistantThreadEntry,
} from "@/lib/schemas/assistantThread"
import type { ServerActionResult } from "@/lib/schemas"
import { SHELL_THREAD_ID } from "@/lib/constants/timbl"

const saveSchema = z.object({
  id: z.string().min(1).default(SHELL_THREAD_ID),
  title: z.string().max(120).optional(),
  sessionId: z.string().min(1).max(100).optional(),
  transcript: z.array(assistantThreadEntrySchema),
  idbMigratedAt: z.string().datetime({ offset: true }).optional(),
})

function parseThread(id: string, orgId: string, data: Record<string, unknown> | undefined): AssistantThread {
  return assistantThreadSchema.parse({
    id,
    organizationId: orgId,
    transcript: [],
    ...(data ?? {}),
  })
}

export async function fetchAssistantThread(
  threadId = SHELL_THREAD_ID,
): Promise<AssistantThread> {
  const orgId = await getCurrentOrgId()
  const snap = await getDb().doc(orgAssistantThreadDocPath(orgId, threadId)).get()
  return parseThread(threadId, orgId, snap.data() as Record<string, unknown> | undefined)
}

export async function saveAssistantThread(
  input: unknown,
): Promise<ServerActionResult & { thread?: AssistantThread }> {
  const parsed = saveSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" }
  }
  const orgId = await getCurrentOrgId()
  const now = new Date().toISOString()
  const id = parsed.data.id
  const ref = getDb().doc(orgAssistantThreadDocPath(orgId, id))
  const prev = await ref.get()
  const body = {
    organizationId: orgId,
    transcript: parsed.data.transcript,
    updatedAt: now,
    createdAt: prev.data()?.createdAt ?? now,
    ...(parsed.data.title ? { title: parsed.data.title } : {}),
    ...(parsed.data.sessionId ? { sessionId: parsed.data.sessionId } : {}),
    ...(parsed.data.idbMigratedAt ? { idbMigratedAt: parsed.data.idbMigratedAt } : {}),
  }
  await ref.set(body, { merge: true })
  return { ok: true, thread: parseThread(id, orgId, { ...(prev.data() as Record<string, unknown> | undefined), ...body }) }
}

export async function appendAssistantEntries(
  entries: AssistantThreadEntry[],
  threadId = SHELL_THREAD_ID,
): Promise<ServerActionResult> {
  if (entries.length === 0) return { ok: true }
  const orgId = await getCurrentOrgId()
  const ref = getDb().doc(orgAssistantThreadDocPath(orgId, threadId))
  const snap = await ref.get()
  const current = parseThread(threadId, orgId, snap.data() as Record<string, unknown> | undefined)
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
      updatedAt: now,
      createdAt: current.createdAt ?? now,
    },
    { merge: true },
  )
  return { ok: true }
}

"use server"

import { z } from "zod"
import { toStructuredEvents, type StructuredEvent, type Event } from "@google/adk"

import { getAdminDb } from "@/lib/firebase/admin"
import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import {
  orgAgentRunsPath,
  orgAgentSessionEventsPath,
} from "@/lib/firebase/paths"

/*
 * Server-action surface for reading the persisted event log of an agent
 * run. The run document carries `sessionId`; the events live under
 *   /organizations/{orgId}/agentSessions/{sessionId}/events
 * keyed by a monotonic `seq` (see lib/agents/runtime/session-service.ts).
 *
 * Raw adk-js Events are converted to flat StructuredEvents server-side so
 * the client never needs the heavy `@google/adk` runtime in its bundle.
 * Each structured row carries its source timestamp + author for the
 * timeline UI.
 */

const getInput = z.object({
  runId: z.string().min(1),
  limit: z.number().int().min(1).max(1_000).default(500),
})

export type TimelineEventRow = {
  /* Composite key: `${seq}:${idx}` so a single raw Event that explodes
   * into multiple structured events still gets unique React keys. */
  key: string
  seq: number
  /** Epoch millis of the underlying raw event. */
  ts: number
  author?: string
  invocationId?: string
  /** Structured event payload (Content / Thought / ToolCall / ...). */
  event: StructuredEvent
}

export type GetAgentSessionResult = {
  sessionId: string | null
  events: TimelineEventRow[]
}

export async function getAgentSession(
  input: unknown,
): Promise<GetAgentSessionResult> {
  const parsed = getInput.parse(input)
  const orgId = await getCurrentOrgId()
  const db = getAdminDb()

  // Look up the run doc to discover sessionId. We don't trust callers to
  // pass session ids directly — runs are the unit the UI selects.
  const runSnap = await db
    .collection(orgAgentRunsPath(orgId))
    .doc(parsed.runId)
    .get()
  if (!runSnap.exists) return { sessionId: null, events: [] }
  const sessionId = (runSnap.data()?.sessionId as string | undefined) ?? null
  if (!sessionId) return { sessionId: null, events: [] }

  const snap = await db
    .collection(orgAgentSessionEventsPath(orgId, sessionId))
    .orderBy("seq", "asc")
    .limit(parsed.limit)
    .get()

  const rows: TimelineEventRow[] = []
  for (const d of snap.docs) {
    const data = d.data() ?? {}
    const seq = typeof data.seq === "number" ? data.seq : 0
    const ts = typeof data.ts === "number" ? data.ts : 0
    const author =
      typeof data.author === "string" && data.author ? data.author : undefined
    const invocationId =
      typeof data.invocationId === "string" && data.invocationId
        ? data.invocationId
        : undefined
    const raw = data.event as Event | undefined
    if (!raw) continue
    let structured: StructuredEvent[]
    try {
      structured = toStructuredEvents(raw)
    } catch {
      continue
    }
    structured.forEach((ev, idx) => {
      rows.push({
        key: `${seq}:${idx}`,
        seq,
        ts,
        author,
        invocationId,
        event: ev,
      })
    })
  }
  return { sessionId, events: rows }
}

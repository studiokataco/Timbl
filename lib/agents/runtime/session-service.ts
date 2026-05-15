import { BaseSessionService } from "@google/adk"
import type {
  AppendEventRequest,
  CreateSessionRequest,
  DeleteSessionRequest,
  Event,
  GetSessionConfig,
  GetSessionRequest,
  ListSessionsRequest,
  ListSessionsResponse,
  Session,
} from "@google/adk"
import { randomUUID } from "node:crypto"

import { getAdminDb } from "@/lib/firebase/admin"
import {
  orgAgentSessionEventsPath,
  orgAgentSessionsPath,
} from "@/lib/firebase/paths"

/*
 * FirestoreSessionService — per-org persistence of adk-js sessions.
 *
 * Each agent run gets a Session doc under
 *   /organizations/{orgId}/agentSessions/{sessionId}
 * and its events are written append-only into
 *   /organizations/{orgId}/agentSessions/{sessionId}/events
 *
 * The service is **org-scoped**: each instance is bound to one orgId at
 * construction time. The runner factory builds a fresh instance per request
 * (see lib/agents/runtime/runner.ts). This is the same pattern adk-js's own
 * VertexAiSessionService uses; sharing one instance across orgs would risk
 * leaking session ids between tenants.
 */

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

function nowMs() {
  return Date.now()
}

export class FirestoreSessionService extends BaseSessionService {
  constructor(private readonly orgId: string) {
    super()
  }

  override async createSession(
    request: CreateSessionRequest,
  ): Promise<Session> {
    const id = request.sessionId ?? randomUUID()
    const now = nowMs()
    const session: Session = {
      id,
      appName: request.appName,
      userId: request.userId,
      state: request.state ?? {},
      events: [],
      lastUpdateTime: now,
    }
    const docRef = getAdminDb()
      .collection(orgAgentSessionsPath(this.orgId))
      .doc(id)
    await docRef.set({
      organizationId: this.orgId,
      appName: session.appName,
      userId: session.userId,
      agentName: (request.state?.["agentName"] as string | undefined) ?? null,
      status: "active",
      state: session.state,
      lastUpdateTime: session.lastUpdateTime,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      ttlAt: new Date(now + SESSION_TTL_MS).toISOString(),
    })
    return session
  }

  override async getSession(
    request: GetSessionRequest,
  ): Promise<Session | undefined> {
    const docRef = getAdminDb()
      .collection(orgAgentSessionsPath(this.orgId))
      .doc(request.sessionId)
    const snap = await docRef.get()
    if (!snap.exists) return undefined
    const data = snap.data()!
    // Defensive: another org should never read this doc, but verify in case
    // the runner was misconstructed.
    if (data.organizationId !== this.orgId) return undefined
    if (data.appName !== request.appName) return undefined
    if (data.userId !== request.userId) return undefined

    const events = await this.loadEvents(request.sessionId, request.config)
    return {
      id: snap.id,
      appName: data.appName,
      userId: data.userId,
      state: (data.state as Record<string, unknown>) ?? {},
      events,
      lastUpdateTime: (data.lastUpdateTime as number) ?? 0,
    }
  }

  override async listSessions(
    request: ListSessionsRequest,
  ): Promise<ListSessionsResponse> {
    const snap = await getAdminDb()
      .collection(orgAgentSessionsPath(this.orgId))
      .where("appName", "==", request.appName)
      .where("userId", "==", request.userId)
      .orderBy("lastUpdateTime", "desc")
      .limit(100)
      .get()
    const sessions: Session[] = snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        appName: data.appName,
        userId: data.userId,
        state: {},
        events: [],
        lastUpdateTime: data.lastUpdateTime ?? 0,
      }
    })
    return { sessions }
  }

  override async deleteSession(
    request: DeleteSessionRequest,
  ): Promise<void> {
    const db = getAdminDb()
    const sessionRef = db
      .collection(orgAgentSessionsPath(this.orgId))
      .doc(request.sessionId)
    // Delete event subcollection in batches before deleting the parent.
    const eventsCol = db.collection(
      orgAgentSessionEventsPath(this.orgId, request.sessionId),
    )
    while (true) {
      const batch = await eventsCol.limit(400).get()
      if (batch.empty) break
      const writeBatch = db.batch()
      for (const doc of batch.docs) writeBatch.delete(doc.ref)
      await writeBatch.commit()
      if (batch.size < 400) break
    }
    await sessionRef.delete()
  }

  override async appendEvent(request: AppendEventRequest): Promise<Event> {
    /* The parent class's appendEvent calls our overridden persistence below
     * after computing state deltas. Re-implementing rather than calling super
     * gives us a chance to apply the state delta atomically *and* write the
     * event doc in the same Firestore round-trip. We mirror the upstream
     * behavior: mutate request.session.events + state, then persist. */
    const { session, event } = request
    const seq = session.events.length
    session.events.push(event)
    session.lastUpdateTime = Math.max(
      session.lastUpdateTime ?? 0,
      event.timestamp,
    )

    const stateDelta =
      (event.actions as { stateDelta?: Record<string, unknown> } | undefined)
        ?.stateDelta ?? {}
    for (const [k, v] of Object.entries(stateDelta)) {
      if (k.startsWith("temp:")) continue
      if (v === null || v === undefined) {
        delete session.state[k]
      } else {
        session.state[k] = v
      }
    }

    const db = getAdminDb()
    const sessionRef = db
      .collection(orgAgentSessionsPath(this.orgId))
      .doc(session.id)
    const eventRef = db
      .collection(orgAgentSessionEventsPath(this.orgId, session.id))
      .doc(event.id || randomUUID())

    const now = new Date().toISOString()
    const batch = db.batch()
    batch.set(
      sessionRef,
      {
        state: session.state,
        lastUpdateTime: session.lastUpdateTime,
        updatedAt: now,
      },
      { merge: true },
    )
    batch.set(eventRef, {
      id: eventRef.id,
      seq,
      ts: event.timestamp,
      invocationId: event.invocationId ?? null,
      author: event.author ?? null,
      // adk-js Events carry FunctionCall / FunctionResponse objects that
      // include Date-like instances; ignoreUndefinedProperties is on for
      // the admin Firestore handle (see lib/firebase/admin.ts), so a plain
      // JSON-safe payload is enough.
      event: JSON.parse(JSON.stringify(event)),
    })
    await batch.commit()
    return event
  }

  private async loadEvents(
    sessionId: string,
    config?: GetSessionConfig,
  ): Promise<Event[]> {
    let query = getAdminDb()
      .collection(orgAgentSessionEventsPath(this.orgId, sessionId))
      .orderBy("seq", "asc") as FirebaseFirestore.Query
    if (config?.afterTimestamp) {
      query = query.where("ts", ">", config.afterTimestamp)
    }
    if (config?.numRecentEvents) {
      // numRecentEvents semantics are "the last N events" — easiest is to
      // grab them desc then reverse client-side.
      const snap = await getAdminDb()
        .collection(orgAgentSessionEventsPath(this.orgId, sessionId))
        .orderBy("seq", "desc")
        .limit(config.numRecentEvents)
        .get()
      return snap.docs
        .map((d) => d.data().event as Event)
        .reverse()
    }
    const snap = await query.get()
    return snap.docs.map((d) => d.data().event as Event)
  }
}

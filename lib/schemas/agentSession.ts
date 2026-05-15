import { z } from "zod"
import { audit, isoTimestamp } from "./_shared"

/*
 * Mirror of the adk-js `Session` shape, persisted to Firestore so the
 * FirestoreSessionService can rehydrate sessions across requests.
 *
 * Events are stored in a subcollection (`agentSessions/{id}/events`), not on
 * the parent doc — Firestore caps a single doc at 1 MiB and long agent
 * conversations would blow through that quickly.
 */

export const agentSessionStatus = z.enum([
  "active",
  "awaiting_human",
  "closed",
])
export type AgentSessionStatus = z.infer<typeof agentSessionStatus>

export const agentSessionSchema = audit.extend({
  id: z.string(),
  organizationId: z.string(),
  agentName: z.string().min(1),
  userId: z.string().min(1),
  appName: z.string().min(1),
  status: agentSessionStatus.default("active"),
  state: z.record(z.string(), z.unknown()).default({}),
  lastUpdateTime: z.number().nonnegative(),
  ttlAt: isoTimestamp.optional(),
})
export type AgentSessionDoc = z.infer<typeof agentSessionSchema>

/* One row per Event, written append-only with a monotonically increasing
 * `seq` so replays are deterministic regardless of clock skew. The Event
 * payload itself is stored opaquely under `event` — the adk-js Event type
 * shifts often and validating its full shape with zod would chase upstream
 * churn for no real protection. */
export const agentSessionEventSchema = z.object({
  id: z.string(),
  seq: z.number().int().nonnegative(),
  ts: z.number().nonnegative(),
  invocationId: z.string().optional(),
  author: z.string().optional(),
  event: z.record(z.string(), z.unknown()),
})
export type AgentSessionEventDoc = z.infer<typeof agentSessionEventSchema>

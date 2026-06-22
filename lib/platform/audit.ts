import "server-only"

import { getAdminDb } from "@/lib/firebase/admin"
import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import {
  platformAuditEntrySchema,
  platformAuditLogPath,
  type PlatformAuditAction,
  type PlatformAuditEntry,
} from "@/lib/platform/schema"

/*
 * Platform audit log - the forensic record of every god-mode action.
 *
 * Unlike the org-level audit (lib/telemetry/audit-events.ts) this is:
 *   - unconditional (no plan gate),
 *   - NON best-effort: the caller MUST await it and let a failure fail the
 *     action. A god-mode mutation that can't be recorded must not proceed
 *     silently.
 */

export interface PlatformAuditInput {
  actorUid: string
  actorEmail: string
  action: PlatformAuditAction
  targetOrgId?: string | null
  target?: { type: string; id: string; label?: string } | null
  meta?: Record<string, unknown>
}

export async function writePlatformAudit(input: PlatformAuditInput): Promise<void> {
  const db = getAdminDb()
  const ref = db.collection(platformAuditLogPath).doc()
  await ref.set({
    id: ref.id,
    actorUid: input.actorUid,
    actorEmail: input.actorEmail,
    action: input.action,
    targetOrgId: input.targetOrgId ?? null,
    target: input.target ?? null,
    meta: input.meta ?? {},
    createdAt: new Date().toISOString(),
  })
}

export interface PlatformAuditQuery {
  action?: PlatformAuditAction
  org?: string
  actorEmail?: string
  after?: string
  before?: string
  sort?: "asc" | "desc"
  cursor?: string
  limit?: number
}

export interface PlatformAuditFeed {
  entries: PlatformAuditEntry[]
  hasMore: boolean
  nextCursor: string | null
}

const FEED_DEFAULT_LIMIT = 50
const FEED_MAX_LIMIT = 200

/* Server-side filtered, cursor-paginated window for the control-centre viewer.
 * Every filter pushes a Firestore where() so we never filter a fetched page in
 * memory - the dataset, not the window, is what gets narrowed. Equality filters
 * combined with the createdAt orderBy require the composite indexes declared in
 * firestore/firestore.indexes.json. Re-asserts platform admin like every read
 * model in lib/platform/queries.ts. */
export async function getPlatformAuditFeed(
  query: PlatformAuditQuery = {},
): Promise<PlatformAuditFeed> {
  await requirePlatformAdmin()
  const limit = Math.min(FEED_MAX_LIMIT, Math.max(1, query.limit ?? FEED_DEFAULT_LIMIT))
  const dir = query.sort === "asc" ? "asc" : "desc"

  let q: FirebaseFirestore.Query = getAdminDb().collection(platformAuditLogPath)
  if (query.action) q = q.where("action", "==", query.action)
  if (query.org) q = q.where("targetOrgId", "==", query.org)
  if (query.actorEmail) q = q.where("actorEmail", "==", query.actorEmail)
  if (query.after) q = q.where("createdAt", ">=", query.after)
  if (query.before) q = q.where("createdAt", "<=", query.before)
  q = q.orderBy("createdAt", dir)
  if (query.cursor) q = q.startAfter(query.cursor)

  const snap = await q.limit(limit + 1).get()
  const page = snap.docs.slice(0, limit)
  const entries: PlatformAuditEntry[] = []
  for (const d of page) {
    const parsed = platformAuditEntrySchema.safeParse({ ...d.data(), id: d.id })
    if (parsed.success) entries.push(parsed.data)
  }
  const hasMore = snap.size > limit
  const last = entries[entries.length - 1]
  return { entries, hasMore, nextCursor: hasMore && last ? last.createdAt : null }
}

export async function listPlatformAudit(limit = 100): Promise<PlatformAuditEntry[]> {
  const snap = await getAdminDb()
    .collection(platformAuditLogPath)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get()
  const out: PlatformAuditEntry[] = []
  for (const d of snap.docs) {
    const parsed = platformAuditEntrySchema.safeParse({ ...d.data(), id: d.id })
    if (parsed.success) out.push(parsed.data)
  }
  return out
}

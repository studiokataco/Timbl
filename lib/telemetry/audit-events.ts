import "server-only"

import { getAdminDb } from "@/lib/firebase/admin"
import { getOrgPlan } from "@/lib/plans/gate"
import { orgAuditLogPath } from "@/lib/firebase/paths"

/*
 * Append-only audit log. Records org-level mutations (category CRUD, plan
 * changes, member add/remove, template create, etc.) so admins can see
 * who-did-what-and-when.
 *
 * Behavior is feature-flag gated:
 *   - Plans with `auditLog: true` (agency_v1, scale_v1) WRITE entries.
 *   - Plans without it (free_v1, studio_v1) silently skip the write.
 *   - Either way, the caller doesn't have to wrap in try/catch - failures
 *     are logged-and-swallowed.
 *
 * Design notes:
 *   - One doc per event, auto-id. Append-only; never updated.
 *   - `actorUserId` may be null for system-initiated changes (cron, signup).
 *   - `target` is a small descriptor of the affected entity; consumers
 *     don't need to re-load the original doc to render a row.
 *   - We intentionally do NOT snapshot the before-state here. Use
 *     approvalsLog (which has a full `before` snapshot for revert) when
 *     undo is needed.
 */

export type AuditEventKind =
  | "category.create"
  | "category.update"
  | "category.delete"
  | "category.reorder"
  | "category.bulk_create"
  | "category.bulk_delete"
  | "template.create"
  | "template.delete"
  | "plan.change"
  | "member.add"
  | "member.update"
  | "member.remove"
  | "brandConfig.update"
  | "onboarding.complete"

export interface AuditEventInput {
  orgId: string
  kind: AuditEventKind
  actorUserId: string | null
  target: {
    type: string
    id: string
    label?: string
  }
  /* Free-form contextual data (e.g. `{ from: "free_v1", to: "agency_v1" }`).
   * Keep small - this is rendered inline in the audit page. */
  meta?: Record<string, unknown>
}

export async function writeAuditEvent(event: AuditEventInput): Promise<void> {
  try {
    const plan = await getOrgPlan(event.orgId)
    if (!plan.features.auditLog) return // Flag gate.

    const db = getAdminDb()
    const ref = db.collection(orgAuditLogPath(event.orgId)).doc()
    await ref.set({
      id: ref.id,
      organizationId: event.orgId,
      kind: event.kind,
      actorUserId: event.actorUserId,
      target: event.target,
      meta: event.meta ?? {},
      createdAt: new Date().toISOString(),
    })
  } catch (err) {
    /* Best-effort. A failed audit write must never break the user's
     * action. Log so we can spot a misconfigured Firestore rule. */
    console.warn(
      `[audit] write failed kind=${event.kind} orgId=${event.orgId}: ${
        err instanceof Error ? err.message : err
      }`,
    )
  }
}

export interface AuditLogRow {
  id: string
  kind: AuditEventKind
  actorUserId: string | null
  target: { type: string; id: string; label?: string }
  meta: Record<string, unknown>
  createdAt: string
}

export async function listAuditLog(
  orgId: string,
  limit = 100,
): Promise<AuditLogRow[]> {
  const snap = await getAdminDb()
    .collection(orgAuditLogPath(orgId))
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get()
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>
    return {
      id: d.id,
      kind: data.kind as AuditEventKind,
      actorUserId: (data.actorUserId as string | null) ?? null,
      target: data.target as AuditLogRow["target"],
      meta: (data.meta as Record<string, unknown>) ?? {},
      createdAt: data.createdAt as string,
    }
  })
}

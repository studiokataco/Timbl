import "server-only"

import { getAdminDb } from "@/lib/firebase/admin"
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

"use server"

import { listPlatformAudit } from "@/lib/platform/audit"
import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import { listPlatformSignals } from "@/lib/platform/signals"
import type { PlatformAuditEntry, PlatformSignal } from "@/lib/platform/schema"

export type PlatformNotification =
  | { type: "audit"; createdAt: string; entry: PlatformAuditEntry }
  | { type: "signal"; createdAt: string; signal: PlatformSignal }

export async function getRecentPlatformNotifications(
  limit = 20,
): Promise<PlatformNotification[]> {
  await requirePlatformAdmin()
  const capped = Math.min(50, Math.max(1, limit))
  const [audit, signals] = await Promise.all([
    listPlatformAudit(capped),
    listPlatformSignals(capped),
  ])
  return [
    ...audit.map(
      (entry): PlatformNotification => ({
        type: "audit",
        createdAt: entry.createdAt,
        entry,
      }),
    ),
    ...signals.map(
      (signal): PlatformNotification => ({
        type: "signal",
        createdAt: signal.createdAt,
        signal,
      }),
    ),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, capped)
}

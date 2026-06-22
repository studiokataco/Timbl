import "server-only"

import { getAdminDb } from "@/lib/firebase/admin"
import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import {
  platformSignalSchema,
  platformSignalsPath,
  type PlatformSignal,
  type PlatformSignalKind,
} from "@/lib/platform/schema"

export interface PlatformSignalInput {
  kind: PlatformSignalKind
  orgId?: string | null
  summary: string
  meta?: Record<string, unknown>
  id?: string
}

export async function writePlatformSignal(input: PlatformSignalInput): Promise<void> {
  const db = getAdminDb()
  const ref = input.id
    ? db.collection(platformSignalsPath).doc(input.id)
    : db.collection(platformSignalsPath).doc()
  await ref.set({
    id: ref.id,
    kind: input.kind,
    orgId: input.orgId ?? null,
    summary: input.summary,
    meta: input.meta ?? {},
    createdAt: new Date().toISOString(),
  })
}

export async function listPlatformSignals(limit = 100): Promise<PlatformSignal[]> {
  await requirePlatformAdmin()
  const snap = await getAdminDb()
    .collection(platformSignalsPath)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get()
  const out: PlatformSignal[] = []
  for (const d of snap.docs) {
    const parsed = platformSignalSchema.safeParse({ ...d.data(), id: d.id })
    if (parsed.success) out.push(parsed.data)
  }
  return out
}

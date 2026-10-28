import "server-only"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgPath, orgUsersPath } from "@/lib/firebase/paths"

const WRITE_INTERVAL_MS = 60 * 60 * 1000
const IDLE_AFTER_MS = 7 * 24 * 60 * 60 * 1000

const lastWrite = new Map<string, number>()

export async function touchWorkspaceActivity(orgId: string, userId: string): Promise<void> {
  const key = `${orgId}/${userId}`
  const nowMs = Date.now()
  if (nowMs - (lastWrite.get(key) ?? 0) < WRITE_INTERVAL_MS) return
  lastWrite.set(key, nowMs)

  const lastActiveAt = new Date(nowMs).toISOString()
  const db = getAdminDb()
  const results = await Promise.allSettled([
    db.doc(orgPath(orgId)).set({ lastActiveAt }, { merge: true }),
    db.doc(`${orgUsersPath(orgId)}/${userId}`).update({ lastActiveAt }),
  ])
  if (results[0].status === "rejected") {
    lastWrite.delete(key)
    console.warn(`[activity] org touch failed for ${orgId}: ${String(results[0].reason)}`)
  }
}

/* Workspaces never stamped fall back to createdAt, so a new workspace gets
 * the full grace period and a long-abandoned one is idle straight away. */
export function isWorkspaceIdle(
  org: { lastActiveAt?: unknown; createdAt?: unknown },
  now = new Date(),
): boolean {
  const last =
    typeof org.lastActiveAt === "string"
      ? org.lastActiveAt
      : typeof org.createdAt === "string"
        ? org.createdAt
        : null
  if (!last) return true
  const lastMs = Date.parse(last)
  if (Number.isNaN(lastMs)) return true
  return now.getTime() - lastMs > IDLE_AFTER_MS
}

import "server-only"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgPath } from "@/lib/firebase/paths"
import { captureServerEvent } from "@/lib/telemetry/posthog-server"

export const ACTIVATION_MILESTONES = [
  "signed_up",
  "brand_set_up",
  "first_draft_created",
  "first_post_scheduled",
  "first_post_published",
] as const
export type ActivationMilestone = (typeof ACTIVATION_MILESTONES)[number]

/* Workspaces created before tracking began already passed some milestones
 * without a stamp; firing "first" events for them would corrupt the funnel. */
const TRACKING_STARTED_AT = "2026-10-29T00:00:00.000Z"

/**
 * Fires each milestone at most once per workspace. The stamp lives on the
 * org doc under `activation.<milestone>`, so retries and concurrent requests
 * cannot double-count. Never throws: analytics must not break a mutation.
 */
export async function recordActivationMilestone(
  orgId: string,
  milestone: ActivationMilestone,
  distinctId: string,
  properties: Record<string, unknown> = {},
): Promise<void> {
  try {
    const db = getAdminDb()
    const ref = db.doc(orgPath(orgId))
    const isFirst = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) return false
      const createdAt = snap.get("createdAt") as string | undefined
      if (!createdAt || createdAt < TRACKING_STARTED_AT) return false
      if (snap.get(`activation.${milestone}`)) return false
      tx.set(ref, { activation: { [milestone]: new Date().toISOString() } }, { merge: true })
      return true
    })
    if (!isFirst) return
    captureServerEvent(distinctId, milestone, { orgId, ...properties }, { organization: orgId })
  } catch (err) {
    console.warn(
      `[activation] ${milestone} soft-fail for ${orgId}: ${err instanceof Error ? err.message : err}`,
    )
  }
}

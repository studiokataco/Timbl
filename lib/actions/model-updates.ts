"use server"

import { getAdminDb } from "@/lib/firebase/admin"
import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { orgPath, orgModelUpdatesPath } from "@/lib/firebase/paths"
import { checkOrgModelUpdates } from "@/lib/agents/model-update-check"
import { modelUpdateSchema, type ModelUpdate } from "@/lib/schemas/modelUpdate"
import type { ServerActionResult } from "@/lib/schemas"

/*
 * Server actions for the notify-only model-update feature (§6.8).
 * Surfaced in the Studio model-updates card. Nothing here applies a
 * model - a human reviews a flagged model and swaps it in the agent
 * playground, then prod-swap A/Bs.
 */

/** Non-dismissed model-update notifications for the current org. */
export async function listModelUpdates(): Promise<ModelUpdate[]> {
  const orgId = await getCurrentOrgId()
  const snap = await getAdminDb()
    .collection(orgModelUpdatesPath(orgId))
    .orderBy("detectedAt", "desc")
    .limit(100)
    .get()
  const out: ModelUpdate[] = []
  for (const d of snap.docs) {
    const r = modelUpdateSchema.safeParse({
      ...(d.data() ?? {}),
      id: d.id,
      organizationId: orgId,
    })
    if (r.success && !r.data.dismissed) out.push(r.data)
  }
  return out
}

/** Run the model-update check on demand ("check now" button). */
export async function runModelUpdateCheckNow(): Promise<
  ServerActionResult & { flagged?: number; checked?: boolean }
> {
  const orgId = await getCurrentOrgId()
  try {
    const res = await checkOrgModelUpdates(orgId)
    return { ok: true, flagged: res.flagged, checked: res.checked }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "check_failed",
    }
  }
}

/** Dismiss a notification so it isn't shown or re-flagged. */
export async function dismissModelUpdate(
  id: string,
): Promise<ServerActionResult> {
  const orgId = await getCurrentOrgId()
  const ref = getAdminDb().collection(orgModelUpdatesPath(orgId)).doc(id)
  if (!(await ref.get()).exists) return { ok: false, error: "not_found" }
  await ref.set(
    { dismissed: true, updatedAt: new Date().toISOString() },
    { merge: true },
  )
  return { ok: true, id }
}

/** Read the per-org notify toggle (defaults ON when unset). */
export async function getNotifyModelUpdates(): Promise<boolean> {
  const orgId = await getCurrentOrgId()
  const snap = await getAdminDb().doc(orgPath(orgId)).get()
  const aiConfig = snap.data()?.aiConfig as
    | { notifyModelUpdates?: boolean }
    | undefined
  return aiConfig?.notifyModelUpdates !== false
}

/** Flip the per-org notify toggle. Off = agents stay pinned, no checks. */
export async function setNotifyModelUpdates(
  enabled: boolean,
): Promise<ServerActionResult> {
  const orgId = await getCurrentOrgId()
  await getAdminDb()
    .doc(orgPath(orgId))
    .set(
      {
        aiConfig: { notifyModelUpdates: enabled },
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    )
  return { ok: true }
}

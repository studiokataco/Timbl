import { getAdminDb } from "@/lib/firebase/admin"
import {
  orgPath,
  orgAgentConfigsPath,
  orgModelUpdatesPath,
} from "@/lib/firebase/paths"

import { MODEL_SUGGESTIONS } from "./provider-catalog"
import { fetchProviderModels, diffNewModels } from "./model-catalog"

/*
 * Core of the notify-only model-update check (§6.8). Shared by the manual
 * "check now" server action and the bi-weekly scheduled function's API
 * route - so the logic lives here, not in either caller.
 *
 * Per org:
 *   1. Honour the `aiConfig.notifyModelUpdates` toggle - off means skip.
 *   2. Build the "known" set: the §4 shortlist (MODEL_SUGGESTIONS) plus
 *      every model currently configured on an agentConfig.
 *   3. Fetch each provider's live model list, diff for plausible newer
 *      family members, and write one modelUpdates doc per new model.
 * Nothing is auto-applied - a human reviews and swaps in Studio.
 */

/** Firestore doc ids can't contain `/`; model ids can. Slugify. */
function slugifyModelId(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

export interface ModelCheckResult {
  /** false when the org has notifications switched off. */
  checked: boolean
  /** Count of newly-written notifications (already-known ones excluded). */
  flagged: number
}

export async function checkOrgModelUpdates(
  orgId: string,
): Promise<ModelCheckResult> {
  const db = getAdminDb()

  const orgSnap = await db.doc(orgPath(orgId)).get()
  const aiConfig = orgSnap.data()?.aiConfig as
    | { notifyModelUpdates?: boolean }
    | undefined
  // Default ON when aiConfig / the field is absent (schema default).
  if (aiConfig?.notifyModelUpdates === false) {
    return { checked: false, flagged: 0 }
  }

  const known = new Set<string>()
  for (const ids of Object.values(MODEL_SUGGESTIONS)) {
    for (const id of ids) known.add(id)
  }
  const cfgSnap = await db.collection(orgAgentConfigsPath(orgId)).get()
  for (const d of cfgSnap.docs) {
    const model = d.data()?.model
    if (typeof model === "string" && model) known.add(model)
  }

  const live = await fetchProviderModels()
  const newModels = diffNewModels(live, known)

  const col = db.collection(orgModelUpdatesPath(orgId))
  const now = new Date().toISOString()
  let flagged = 0
  for (const m of newModels) {
    const docId = slugifyModelId(m.id)
    const ref = col.doc(docId)
    // Skip a model already flagged - re-flagging would resurface a
    // notification the operator may have dismissed.
    if ((await ref.get()).exists) continue
    await ref.set({
      id: docId,
      organizationId: orgId,
      provider: m.provider,
      modelId: m.id,
      detectedAt: now,
      dismissed: false,
      createdAt: now,
      updatedAt: now,
    })
    flagged++
  }

  return { checked: true, flagged }
}

/** Run the check for every org - used by the scheduled-function route. */
export async function checkAllOrgsModelUpdates(): Promise<{
  orgs: number
  flagged: number
}> {
  const db = getAdminDb()
  const orgs = await db.collection("organizations").get()
  let flagged = 0
  for (const org of orgs.docs) {
    try {
      const res = await checkOrgModelUpdates(org.id)
      flagged += res.flagged
    } catch (err) {
      console.warn(
        `[model-update-check] org=${org.id} failed: ${err instanceof Error ? err.message : err}`,
      )
    }
  }
  return { orgs: orgs.size, flagged }
}

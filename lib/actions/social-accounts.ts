"use server"

import { revalidatePath } from "next/cache"

import { getCurrentOrgId, getDb } from "@/lib/auth/server-helpers"
import { orgSocialAccountsPath } from "@/lib/firebase/paths"
import { snapToData, type WithId } from "@/lib/firebase/serialize"
import { getOrgPlan, PlanGateError } from "@/lib/plans/gate"
import {
  socialAccountPublicSchema,
  type SocialAccountPublic,
  type ServerActionResult,
} from "@/lib/schemas"

/* Connected accounts are gated against the plan's `brands` quota. Each brand
 * may connect up to this many channels - enough to cover all v1 platforms. */
const CHANNELS_PER_BRAND = 4

async function countActive(orgId: string): Promise<number> {
  const snap = await getDb()
    .collection(orgSocialAccountsPath(orgId))
    .where("status", "in", ["active", "needs_reauth"])
    .get()
  return snap.size
}

/* Throws PlanGateError when the org has hit its connectable-account cap.
 * Called by the connect route before redirecting to the provider. */
export async function assertCanConnect(orgId: string): Promise<void> {
  const plan = await getOrgPlan(orgId)
  const brands = plan.quotas.brands
  if (brands === null) return
  const limit = brands * CHANNELS_PER_BRAND
  const used = await countActive(orgId)
  if (used >= limit) {
    throw new PlanGateError({
      kind: "quota",
      metric: "brands",
      limit,
      used,
      currentTier: plan.tier,
    })
  }
}

export async function listSocialAccounts(): Promise<WithId<SocialAccountPublic>[]> {
  const orgId = await getCurrentOrgId()
  const snap = await getDb().collection(orgSocialAccountsPath(orgId)).get()
  const out: WithId<SocialAccountPublic>[] = []
  for (const d of snap.docs) {
    const parsed = socialAccountPublicSchema.safeParse(snapToData(d))
    if (parsed.success) out.push(parsed.data as WithId<SocialAccountPublic>)
  }
  return out
}

export async function disconnectAccount(id: string): Promise<ServerActionResult> {
  if (!id) return { ok: false, error: "Missing account id" }
  const orgId = await getCurrentOrgId()
  await getDb().doc(`${orgSocialAccountsPath(orgId)}/${id}`).delete()
  revalidatePath("/settings/integrations")
  return { ok: true, id }
}

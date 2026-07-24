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

import { DEFAULT_BRAND_ID } from "@/lib/constants/timbl"

/* One connectable channel per platform, per brand. The plan's `brands` quota
 * caps how many brands exist (enforced at brand creation); this caps channels
 * within a single brand. */
const CHANNELS_PER_BRAND = 4

/* Counts active accounts for one brand. Reads the whole (tiny) active set and
 * filters in memory rather than a `where("brandId", ...)` query, because
 * accounts connected before the brandId backfill have no brandId field at all
 * and a Firestore equality filter would silently skip them - undercounting the
 * cap. A missing field is treated as the default brand. */
async function countActiveForBrand(orgId: string, brandId: string): Promise<number> {
  const snap = await getDb()
    .collection(orgSocialAccountsPath(orgId))
    .where("status", "in", ["active", "needs_reauth"])
    .get()
  return snap.docs.filter(
    (d) => ((d.data().brandId as string | undefined) ?? DEFAULT_BRAND_ID) === brandId,
  ).length
}

/* Throws PlanGateError when the brand has hit its connectable-channel cap.
 * Called by the connect route before redirecting to the provider. */
export async function assertCanConnect(
  orgId: string,
  brandId: string = DEFAULT_BRAND_ID,
): Promise<void> {
  const plan = await getOrgPlan(orgId)
  const used = await countActiveForBrand(orgId, brandId)
  if (used >= CHANNELS_PER_BRAND) {
    throw new PlanGateError({
      kind: "quota",
      metric: "brands",
      limit: CHANNELS_PER_BRAND,
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

import "server-only"

import type { Firestore } from "firebase-admin/firestore"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgBrandsPath, orgBrandDocPath, orgBrandConfigDocPath } from "@/lib/firebase/paths"
import { DEFAULT_BRAND_ID } from "@/lib/constants/timbl"
import { brandConfigSchema, type BrandConfig } from "@/lib/schemas/brandConfig"

/*
 * The one place that knows where a brand lives. Every reader and writer goes
 * through here so the legacy /brandConfig/default location and the real
 * /brands/{brandId} location are reconciled in exactly one spot - not in six
 * call sites each hardcoding id:"default".
 */

export async function readBrand(
  orgId: string,
  brandId: string = DEFAULT_BRAND_ID,
  db: Firestore = getAdminDb(),
): Promise<BrandConfig | null> {
  const primary = await db.doc(orgBrandDocPath(orgId, brandId)).get()
  let data = primary.exists ? primary.data() : undefined
  /* Legacy fallback for the default brand only, and only until the backfill
   * copies /brandConfig/default forward. Non-default brands never lived there. */
  if (!data && brandId === DEFAULT_BRAND_ID) {
    const legacy = await db.doc(orgBrandConfigDocPath(orgId)).get()
    if (legacy.exists) data = legacy.data()
  }
  if (!data) return null
  const parsed = brandConfigSchema.safeParse({ ...data, id: brandId, organizationId: orgId })
  return parsed.success ? parsed.data : null
}

export async function writeBrand(
  orgId: string,
  patch: Partial<BrandConfig>,
  brandId: string = DEFAULT_BRAND_ID,
): Promise<BrandConfig | null> {
  const ref = getAdminDb().doc(orgBrandDocPath(orgId, brandId))
  const now = new Date().toISOString()
  const existing = await ref.get()
  /* createdAt only on create - putting it in a merge payload would reset it on
   * every edit, which is what the old per-call-site writers did wrong. */
  const doc: Record<string, unknown> = {
    id: brandId,
    organizationId: orgId,
    ...patch,
    updatedAt: now,
  }
  if (!existing.exists) doc.createdAt = now
  await ref.set(doc, { merge: true })
  const snap = await ref.get()
  const parsed = brandConfigSchema.safeParse({
    ...(snap.data() ?? {}),
    id: brandId,
    organizationId: orgId,
  })
  return parsed.success ? parsed.data : null
}

export async function listBrands(
  orgId: string,
  db: Firestore = getAdminDb(),
): Promise<BrandConfig[]> {
  const snap = await db.collection(orgBrandsPath(orgId)).get()
  const out: BrandConfig[] = []
  for (const doc of snap.docs) {
    const parsed = brandConfigSchema.safeParse({
      ...doc.data(),
      id: doc.id,
      organizationId: orgId,
    })
    if (parsed.success) out.push(parsed.data)
  }
  return out
}

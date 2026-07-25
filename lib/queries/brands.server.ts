import "server-only"

import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { getCurrentBrandId } from "@/lib/brand/brand-session"
import { listBrands, readBrand } from "@/lib/brand/brand-store"
import { getOrgPlan } from "@/lib/plans/gate"
import { DEFAULT_BRAND_ID } from "@/lib/constants/timbl"

export type BrandSummary = { id: string; name: string }
export type BrandSwitcherData = {
  current: BrandSummary
  brands: BrandSummary[]
  atCap: boolean
}

export async function getBrandSwitcherData(): Promise<BrandSwitcherData> {
  const orgId = await getCurrentOrgId()
  const [brands, currentId, plan] = await Promise.all([
    listBrands(orgId),
    getCurrentBrandId(orgId),
    getOrgPlan(orgId),
  ])

  const list: BrandSummary[] = brands.map((b) => ({ id: b.id, name: b.name }))
  /* Legacy orgs still keep their brand at /brandConfig/default, so the brands
   * collection can be empty - guarantee the default is always selectable. */
  if (!list.some((b) => b.id === DEFAULT_BRAND_ID)) {
    const def = await readBrand(orgId, DEFAULT_BRAND_ID)
    list.unshift({ id: DEFAULT_BRAND_ID, name: def?.name ?? "Default brand" })
  }
  list.sort((a, b) =>
    a.id === DEFAULT_BRAND_ID ? -1 : b.id === DEFAULT_BRAND_ID ? 1 : a.name.localeCompare(b.name),
  )

  const current =
    list.find((b) => b.id === currentId) ??
    list.find((b) => b.id === DEFAULT_BRAND_ID) ??
    list[0]

  const cap = plan.quotas.brands
  const atCap = cap !== null && list.length >= cap

  return { current, brands: list, atCap }
}

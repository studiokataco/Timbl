import "server-only"

import { cache } from "react"

import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { getCurrentBrandId } from "@/lib/brand/brand-session"
import { listBrands, readBrand } from "@/lib/brand/brand-store"
import { getOrgPlan } from "@/lib/plans/gate"
import { DEFAULT_BRAND_ID } from "@/lib/constants/timbl"
import type { BrandConfig } from "@/lib/schemas/brandConfig"

function toSummary(b: BrandConfig): BrandSummary {
  return {
    id: b.id,
    name: b.name,
    avatarUrl: b.avatarUrl,
    color: b.color,
    channels: b.channels,
    voice: b.voice.slice(0, 240),
    audience: b.audience.slice(0, 240),
    perWeek: b.targetCadence.perWeek,
  }
}

export type BrandSummary = {
  id: string
  name: string
  avatarUrl?: string
  color?: string
  channels: BrandConfig["channels"]
  voice: string
  audience: string
  perWeek: number
}
export type BrandSwitcherData = {
  current: BrandSummary
  brands: BrandSummary[]
  atCap: boolean
}

export const getBrandSwitcherData = cache(async (): Promise<BrandSwitcherData> => {
  const orgId = await getCurrentOrgId()
  const [brands, currentId, plan] = await Promise.all([
    listBrands(orgId),
    getCurrentBrandId(orgId),
    getOrgPlan(orgId),
  ])

  const list: BrandSummary[] = brands.map(toSummary)
  /* Legacy orgs still keep their brand at /brandConfig/default, so the brands
   * collection can be empty - guarantee the default is always selectable. */
  if (!list.some((b) => b.id === DEFAULT_BRAND_ID)) {
    const def = await readBrand(orgId, DEFAULT_BRAND_ID)
    list.unshift(
      def ? toSummary(def) : {
            id: DEFAULT_BRAND_ID,
            name: "Default brand",
            channels: [],
            voice: "",
            audience: "",
            perWeek: 3,
          },
    )
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
})

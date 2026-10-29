export const dynamic = "force-dynamic"

import { notFound } from "next/navigation"

import { BrandDetail } from "@/components/settings/brand-detail"
import { getCurrentUserProfile } from "@/lib/identity/profile.server"
import { getBrandSwitcherData } from "@/lib/queries/brands.server"

export default async function SettingsBrandPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const [{ brandId }, { tab }, data, profile] = await Promise.all([
    params,
    searchParams,
    getBrandSwitcherData(),
    getCurrentUserProfile(),
  ])
  const brand = data.brands.find((b) => b.id === brandId)
  if (!brand) notFound()

  return (
    <BrandDetail
      brand={brand}
      brands={data.brands}
      activeId={data.current.id}
      tab={tab === "voice" ? "voice" : "identity"}
      canEdit={profile.role !== "contributor"}
    />
  )
}

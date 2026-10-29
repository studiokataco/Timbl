export const dynamic = "force-dynamic"

import { BrandList } from "@/components/settings/brand-list"
import { getCurrentUserProfile } from "@/lib/identity/profile.server"
import { getBrandSwitcherData } from "@/lib/queries/brands.server"

export default async function SettingsBrandsPage() {
  const [data, profile] = await Promise.all([getBrandSwitcherData(), getCurrentUserProfile()])
  return <BrandList data={data} canEdit={profile.role !== "contributor"} />
}

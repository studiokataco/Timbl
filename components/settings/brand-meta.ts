import type { BrandSummary } from "@/lib/queries/brands.server"

export function brandTagline(brand: BrandSummary) {
  return brand.voice.trim() || "Voice not set yet. Run the interview to teach the AI how this brand sounds."
}

export function cadenceLabel(brand: BrandSummary) {
  return brand.perWeek === 1 ? "1 post a week" : `${brand.perWeek} posts a week`
}

export const STARTER_BRAND_NAME = "Default brand"

export function hasStarterName(brand: Pick<BrandSummary, "name">) {
  return brand.name.trim() === STARTER_BRAND_NAME
}

"use server"

import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { DEFAULT_BRAND_ID } from "@/lib/constants/timbl"
import { readBrand, writeBrand } from "@/lib/brand/brand-store"
import {
  brandConfigPatchSchema,
  type BrandConfig,
} from "@/lib/schemas/brandConfig"
import type { ServerActionResult } from "@/lib/schemas"

export async function fetchBrandConfig(
  brandId: string = DEFAULT_BRAND_ID,
): Promise<BrandConfig | null> {
  const orgId = await getCurrentOrgId()
  return readBrand(orgId, brandId)
}

export async function updateBrandConfig(
  input: unknown,
  brandId: string = DEFAULT_BRAND_ID,
): Promise<ServerActionResult> {
  const parsed = brandConfigPatchSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid patch" }
  }
  const orgId = await getCurrentOrgId()
  await writeBrand(orgId, parsed.data, brandId)
  return { ok: true, id: brandId }
}

"use server"

import { randomUUID } from "node:crypto"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { z } from "zod"

import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { getOrgPlan, PlanGateError, gateErrorToResult } from "@/lib/plans/gate"
import { listBrands, readBrand, writeBrand } from "@/lib/brand/brand-store"
import { getAdminDb } from "@/lib/firebase/admin"
import { orgBrandDocPath } from "@/lib/firebase/paths"
import { BRAND_COOKIE, DEFAULT_BRAND_ID } from "@/lib/constants/timbl"
import type { BrandConfig } from "@/lib/schemas/brandConfig"
import type { ServerActionResult } from "@/lib/schemas"

const createSchema = z.object({ name: z.string().min(1).max(120) })
const renameSchema = z.object({ brandId: z.string().min(1), name: z.string().min(1).max(120) })

export async function createBrand(input: unknown): Promise<ServerActionResult> {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid name" }
  }
  const orgId = await getCurrentOrgId()
  const [plan, brands] = await Promise.all([getOrgPlan(orgId), listBrands(orgId)])
  const cap = plan.quotas.brands
  if (cap !== null && brands.length >= cap) {
    const gate = gateErrorToResult(
      new PlanGateError({
        kind: "quota",
        metric: "brands",
        limit: cap,
        used: brands.length,
        currentTier: plan.tier,
      }),
    )
    if (gate) return gate
  }

  const brandId = randomUUID()
  await writeBrand(
    orgId,
    {
      name: parsed.data.name,
      voice: "",
      audience: "",
      channels: [],
      targetCadence: { perWeek: 3, preferredDays: [], preferredTimes: [] },
      forbiddenTopics: [],
      samplePosts: [],
    },
    brandId,
  )
  revalidatePath("/", "layout")
  return { ok: true, id: brandId }
}

export async function renameBrand(input: unknown): Promise<ServerActionResult> {
  const parsed = renameSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" }
  }
  const orgId = await getCurrentOrgId()
  const existing = await readBrand(orgId, parsed.data.brandId)
  if (!existing) return { ok: false, error: "Brand not found" }
  await writeBrand(orgId, { name: parsed.data.name }, parsed.data.brandId)
  revalidatePath("/", "layout")
  return { ok: true, id: parsed.data.brandId }
}

/* Switches the session's active brand. Validates the brand exists in this org
 * before trusting the cookie value. */
export async function setCurrentBrand(brandId: string): Promise<ServerActionResult> {
  const orgId = await getCurrentOrgId()
  const target = brandId || DEFAULT_BRAND_ID
  if (target !== DEFAULT_BRAND_ID) {
    const snap = await getAdminDb().doc(orgBrandDocPath(orgId, target)).get()
    if (!snap.exists) return { ok: false, error: "Brand not found" }
  }
  ;(await cookies()).set(BRAND_COOKIE, target, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  })
  revalidatePath("/", "layout")
  return { ok: true, id: target }
}

export async function listBrandsForCurrentOrg(): Promise<BrandConfig[]> {
  const orgId = await getCurrentOrgId()
  return listBrands(orgId)
}

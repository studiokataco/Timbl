"use server"

import { z } from "zod"

import { getAdminDb } from "@/lib/firebase/admin"
import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { orgBrandConfigDocPath } from "@/lib/firebase/paths"
import {
  brandConfigSchema,
  brandConfigPatchSchema,
  type BrandConfig,
} from "@/lib/schemas/brandConfig"

const ServerActionResult = z.object({
  ok: z.boolean(),
  id: z.string().optional(),
  error: z.string().optional(),
})
export type ServerActionResult = z.infer<typeof ServerActionResult>

export async function fetchBrandConfig(): Promise<BrandConfig | null> {
  const orgId = await getCurrentOrgId()
  const snap = await getAdminDb().doc(orgBrandConfigDocPath(orgId)).get()
  if (!snap.exists) return null
  const parsed = brandConfigSchema.safeParse({
    ...(snap.data() ?? {}),
    id: "default",
    organizationId: orgId,
  })
  return parsed.success ? parsed.data : null
}

export async function updateBrandConfig(
  input: unknown,
): Promise<ServerActionResult> {
  const parsed = brandConfigPatchSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid patch" }
  }
  const orgId = await getCurrentOrgId()
  const ref = getAdminDb().doc(orgBrandConfigDocPath(orgId))
  const now = new Date().toISOString()
  await ref.set(
    {
      id: "default",
      organizationId: orgId,
      ...parsed.data,
      updatedAt: now,
      // createdAt is preserved by merge:true if it already exists.
      createdAt: now,
    },
    { merge: true },
  )
  return { ok: true, id: "default" }
}

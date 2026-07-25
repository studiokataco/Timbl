import "server-only"

import { cookies } from "next/headers"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgBrandDocPath } from "@/lib/firebase/paths"
import { BRAND_COOKIE, DEFAULT_BRAND_ID } from "@/lib/constants/timbl"

/*
 * Which brand the current session is acting on, resolved from the BRAND_COOKIE
 * and validated against the given org. The cookie is org-agnostic, so a value
 * left over from another workspace is rejected here rather than trusted - an
 * unknown brand falls back to the default. The default never needs a read.
 */
export async function getCurrentBrandId(orgId: string): Promise<string> {
  const raw = (await cookies()).get(BRAND_COOKIE)?.value
  if (!raw || raw === DEFAULT_BRAND_ID) return DEFAULT_BRAND_ID
  const snap = await getAdminDb().doc(orgBrandDocPath(orgId, raw)).get()
  return snap.exists ? raw : DEFAULT_BRAND_ID
}

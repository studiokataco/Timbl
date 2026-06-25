"use server"

import { z } from "zod"

import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { getAdminDb } from "@/lib/firebase/admin"
import { platformRealtimeHealthDocPath } from "@/lib/platform/schema"

const input = z.object({
  orgId: z.string().min(1),
  reason: z.string().min(1).max(200),
})

export async function reportRealtimeDegrade(raw: unknown): Promise<void> {
  const parsed = input.safeParse(raw)
  if (!parsed.success) return
  const { orgId, reason } = parsed.data

  const currentOrg = await getCurrentOrgId()
  if (currentOrg !== orgId) return

  const now = new Date().toISOString()
  await getAdminDb()
    .doc(platformRealtimeHealthDocPath(orgId))
    .set(
      {
        orgId,
        reason,
        degradedAt: now,
        updatedAt: now,
      },
      { merge: true },
    )
}

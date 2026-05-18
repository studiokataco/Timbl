"use server"

import { z } from "zod"
import { getCurrentOrgId, getCurrentUser, getDb } from "@/lib/auth/server-helpers"
import { orgUsersPath } from "@/lib/firebase/paths"
import { snapToData } from "@/lib/firebase/serialize"
import type { User, ServerActionResult } from "@/lib/schemas"

const preferencesPatchSchema = z
  .object({
    onboarded: z.boolean().optional(),
  })
  .partial()

/*
 * Returns the current user's preferences. Used by the onboarding dialog to
 * decide whether to show itself on first load.
 */
export async function fetchCurrentUserPreferences(): Promise<{
  onboarded: boolean
}> {
  const orgId = await getCurrentOrgId()
  const user = await getCurrentUser()
  const snap = await getDb().doc(`${orgUsersPath(orgId)}/${user.id}`).get()
  if (!snap.exists) return { onboarded: false }
  const u = snapToData<User>(snap)
  return { onboarded: !!u.preferences?.onboarded }
}

export async function updateCurrentUserPreferences(
  input: unknown,
): Promise<ServerActionResult> {
  const parsed = preferencesPatchSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" }
  }
  const orgId = await getCurrentOrgId()
  const user = await getCurrentUser()
  await getDb()
    .doc(`${orgUsersPath(orgId)}/${user.id}`)
    .set(
      {
        preferences: parsed.data,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    )
  return { ok: true }
}

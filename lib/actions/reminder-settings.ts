"use server"

import { z } from "zod"

import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { getAdminDb } from "@/lib/firebase/admin"
import { orgPath } from "@/lib/firebase/paths"
import { resolveReminderPreferences } from "@/lib/reminders/preferences"
import {
  reminderPreferencesSchema,
  type ReminderPreferences,
} from "@/lib/schemas/organisation"
import type { ServerActionResult } from "@/lib/schemas"

const updateReminderSettingsInputSchema = reminderPreferencesSchema.partial()

export async function getReminderSettings(): Promise<ReminderPreferences> {
  const orgId = await getCurrentOrgId()
  const snap = await getAdminDb().doc(orgPath(orgId)).get()
  const stored = snap.data()?.reminderPreferences as
    | Partial<ReminderPreferences>
    | undefined
  return resolveReminderPreferences(stored)
}

export async function updateReminderSettings(
  input: unknown,
): Promise<ServerActionResult> {
  const parsed = updateReminderSettingsInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" }
  }
  if (Object.keys(parsed.data).length === 0) {
    return { ok: false, error: "empty_patch" }
  }

  const orgId = await getCurrentOrgId()
  const snap = await getAdminDb().doc(orgPath(orgId)).get()
  const current = resolveReminderPreferences(
    snap.data()?.reminderPreferences as Partial<ReminderPreferences> | undefined,
  )
  const next = reminderPreferencesSchema.parse({ ...current, ...parsed.data })

  await getAdminDb()
    .doc(orgPath(orgId))
    .set(
      {
        reminderPreferences: next,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    )

  return { ok: true }
}

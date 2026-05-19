"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getAdminDb } from "@/lib/firebase/admin"
import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import {
  orgAgentConfigsPath,
  orgCategoriesPath,
  orgPath,
} from "@/lib/firebase/paths"
import {
  getIndustryDefaults,
  type CategorySuggestion,
} from "@/lib/onboarding/industry-defaults"
import type { ServerActionResult } from "@/lib/schemas"

/*
 * Onboarding mutations. The wizard calls these in order — each step
 * persists immediately so a tab close mid-flow doesn't lose work. Only
 * `completeOnboarding` flips the `completedAt` flag and unlocks /(app).
 *
 * `applySelections` is idempotent — re-running the wizard from settings
 * will skip categories that already exist by slug. We never delete
 * existing categories the user already created (that's the dedicated
 * /settings/categories surface).
 */

const profileInput = z.object({
  industry: z.string().min(1),
  audience: z.string().max(280).optional(),
  tone: z.string().max(280).optional(),
})

const selectionsInput = z.object({
  /* Category slugs the user kept selected on step 3. */
  categorySlugs: z.array(z.string().min(1)).default([]),
  /* Agent ids the user enabled on step 2. */
  agentIds: z.array(z.string().min(1)).default([]),
  /* Channels the user said they care about on step 5. */
  channels: z.array(z.string().min(1)).default([]),
})

const completeInput = z.object({
  skippedSteps: z.array(z.string()).default([]),
})

export async function saveOnboardingProfile(
  input: unknown,
): Promise<ServerActionResult> {
  const parsed = profileInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  const orgId = await getCurrentOrgId()
  await getAdminDb().doc(orgPath(orgId)).set(
    {
      onboarding: {
        profile: parsed.data,
      },
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  )
  return { ok: true, id: orgId }
}

/* Persists the picked categories + agent toggles + channel hints. Channels
 * land on the onboarding profile (no real channel-connection collection
 * exists pre-Phase-7); agent toggles patch each agentConfig's `isEnabled`
 * flag; categories are upserted by slug. */
export async function applyOnboardingSelections(
  input: unknown,
): Promise<ServerActionResult> {
  const parsed = selectionsInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  const orgId = await getCurrentOrgId()
  const db = getAdminDb()

  /* 1. Categories: upsert from the industry defaults, filtered by what
   * the user picked. Existing slugs are merged (no displaceOrder reset). */
  const orgSnap = await db.doc(orgPath(orgId)).get()
  const industry = (orgSnap.data()?.onboarding?.profile?.industry as string | undefined) ?? "other"
  const defaults = getIndustryDefaults(industry)

  const picked: CategorySuggestion[] = defaults.categories.filter((c) =>
    parsed.data.categorySlugs.includes(c.slug),
  )
  const now = new Date().toISOString()
  const catCol = db.collection(orgCategoriesPath(orgId))

  /* Determine current max displayOrder so appended categories show at
   * the bottom of the user's calendar, not interleaved randomly. */
  const existingMax = await catCol.orderBy("displayOrder", "desc").limit(1).get()
  let nextOrder =
    ((existingMax.docs[0]?.data().displayOrder as number | undefined) ?? -1) + 1

  for (const cat of picked) {
    const ref = catCol.doc(cat.slug)
    const existing = await ref.get()
    if (existing.exists) continue
    await ref.set({
      id: cat.slug,
      organizationId: orgId,
      slug: cat.slug,
      name: cat.name,
      color: cat.color,
      icon: cat.icon,
      defaultPostType: cat.defaultPostType,
      defaultHashtags: [],
      isActive: true,
      displayOrder: nextOrder,
      /* Wizard-created categories are user-owned; deletable. Seeded
       * SAFE/system rows keep `system: true`. */
      system: false,
      createdAt: now,
      updatedAt: now,
    })
    nextOrder += 1
  }

  /* 2. Agent toggles: patch isEnabled on existing agentConfigs. We do
   * not create new agentConfig docs from here — the catalog is seeded
   * by defaults.ts. The wizard just turns rows on/off. */
  const agentCol = db.collection(orgAgentConfigsPath(orgId))
  const allAgents = await agentCol.get()
  const batch = db.batch()
  allAgents.docs.forEach((doc) => {
    const want = parsed.data.agentIds.includes(doc.id)
    batch.set(
      doc.ref,
      { isEnabled: want, updatedAt: now },
      { merge: true },
    )
  })
  await batch.commit()

  /* 3. Channels: persisted on the onboarding profile (not authoritative
   * for connection state — just the user's stated preference). */
  await db.doc(orgPath(orgId)).set(
    {
      onboarding: {
        profile: {
          channels: parsed.data.channels,
        },
      },
      updatedAt: now,
    },
    { merge: true },
  )

  revalidatePath("/calendar")
  revalidatePath("/settings/categories")
  return { ok: true, id: orgId }
}

export async function completeOnboarding(
  input: unknown,
): Promise<ServerActionResult> {
  const parsed = completeInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  const orgId = await getCurrentOrgId()
  await getAdminDb().doc(orgPath(orgId)).set(
    {
      onboarding: {
        completedAt: new Date().toISOString(),
        skippedSteps: parsed.data.skippedSteps,
      },
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  )
  revalidatePath("/")
  return { ok: true, id: orgId }
}

/* Re-run-setup escape hatch: clears completedAt so the (app) layout
 * redirects to /onboarding on next nav. The user's existing categories
 * etc. stay intact — re-running the wizard just augments. */
export async function resetOnboarding(): Promise<ServerActionResult> {
  const orgId = await getCurrentOrgId()
  await getAdminDb().doc(orgPath(orgId)).set(
    {
      onboarding: {
        completedAt: null,
      },
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  )
  return { ok: true, id: orgId }
}

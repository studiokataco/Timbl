"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getAdminDb } from "@/lib/firebase/admin"
import { getCurrentOrgId, getCurrentUser } from "@/lib/auth/server-helpers"
import {
  orgAgentConfigsPath,
  orgBrandConfigDocPath,
  orgCategoriesPath,
  orgPath,
  orgTemplatesPath,
} from "@/lib/firebase/paths"
import {
  getIndustryDefaults,
  type CategorySuggestion,
} from "@/lib/onboarding/industry-defaults"
import {
  getStarterTemplate,
  type StarterTemplate,
} from "@/lib/onboarding/template-library"
import { WIZARD_AGENT_IDS } from "@/lib/onboarding/agent-catalog"
import { getAgentDefault } from "@/lib/agents/defaults"
import { writeAuditEvent } from "@/lib/telemetry/audit-events"
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
  /* Workspace display name — lands on the org doc's `name`, not inside
   * onboarding.profile. Optional so a blank field doesn't wipe the name. */
  name: z.string().min(1).max(120).optional(),
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
  /* Template slugs the user kept selected on step 4. */
  templateSlugs: z.array(z.string().min(1)).default([]),
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
  const { name, ...profile } = parsed.data
  await getAdminDb().doc(orgPath(orgId)).set(
    {
      /* Only set `name` when the user actually typed one — an empty field
       * must not blank out the org's existing name on a wizard re-run. */
      ...(name ? { name } : {}),
      onboarding: { profile },
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  )
  revalidatePath("/", "layout")
  return { ok: true, id: orgId }
}

/* Persists everything the wizard collected: categories upserted by slug;
 * the wizard-selectable agents toggled via their `enabled` flag and, when
 * enabled, re-tailored with a workspace-context prompt block; templates
 * materialised from the starter library; channels stored on the profile;
 * and a brandConfig doc seeded so every workflow agent reads the niche at
 * run time. */
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

  /* 2. Agent toggles + niche tailoring. We touch ONLY the wizard-
   * selectable agents — never the config / pipeline-machinery agents,
   * which must stay enabled or the agent runtime breaks. We write
   * `enabled` (the field the schema, seeds, and AI Command Centre all
   * read — the wizard used to write a dead `isEnabled` field). For each
   * enabled pick we rebuild `systemPrompt` from the agent's default plus
   * a workspace-context block; rebuilding from the default (not the
   * stored prompt) keeps it idempotent across wizard re-runs. */
  const orgName =
    (orgSnap.data()?.name as string | undefined) ?? "this workspace"
  const profile = (orgSnap.data()?.onboarding?.profile ?? {}) as {
    audience?: string
    tone?: string
  }
  const agentCol = db.collection(orgAgentConfigsPath(orgId))
  const batch = db.batch()
  for (const agentId of WIZARD_AGENT_IDS) {
    const ref = agentCol.doc(agentId)
    if (!(await ref.get()).exists) continue
    const enabled = parsed.data.agentIds.includes(agentId)
    const patch: Record<string, unknown> = { enabled, updatedAt: now }
    if (enabled) {
      const tailored = tailorAgentPrompt(agentId, {
        orgName,
        industryLabel: defaults.label,
        audience: profile.audience,
        tone: profile.tone,
      })
      if (tailored) patch.systemPrompt = tailored
    }
    batch.set(ref, patch, { merge: true })
  }
  await batch.commit()

  /* 3. Templates: write each picked starter-library row into the org's
   * /templates collection. Skips rows that already exist (re-running the
   * wizard never clobbers user edits). categoryId is resolved to a
   * present category at write time so a user who deselected the suggested
   * category in step 3 still gets a usable template. */
  if (parsed.data.templateSlugs.length > 0) {
    const tplCol = db.collection(orgTemplatesPath(orgId))
    const allCats = await db.collection(orgCategoriesPath(orgId)).get()
    const catSlugs = new Set(allCats.docs.map((d) => d.data().slug as string))
    const firstCategoryId =
      (allCats.docs[0]?.data().id as string | undefined) ??
      (allCats.docs[0]?.data().slug as string | undefined)

    for (const slug of parsed.data.templateSlugs) {
      const lib = getStarterTemplate(slug)
      if (!lib) continue
      const ref = tplCol.doc(slug)
      if ((await ref.get()).exists) continue
      const categoryId = resolveCategoryForTemplate(lib, catSlugs, firstCategoryId)
      if (!categoryId) continue // No categories at all — skip rather than orphan.
      await ref.set({
        id: slug,
        organizationId: orgId,
        name: lib.name,
        categoryId,
        defaultPostType: lib.defaultPostType,
        defaultHashtags: lib.defaultHashtags,
        blurbTemplate: lib.blurbTemplate,
        cadence: lib.cadence,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  /* 4. Channels: persisted on the onboarding profile (not authoritative
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

  /* 5. Brand config: the single doc every workflow agent reads at run
   * time via readBrandConfig. Seeding it from the wizard profile means
   * the niche reaches agents even beyond the spliced prompts. Cadence is
   * written only on first create — a wizard re-run must not reset a
   * cadence the user has since tuned in /settings/brand. */
  const VALID_BRAND_CHANNELS = ["instagram", "facebook", "linkedin", "website", "fb_groups"]
  const brandChannels = parsed.data.channels.filter((c) =>
    VALID_BRAND_CHANNELS.includes(c),
  )
  const wizardProfile = (orgSnap.data()?.onboarding?.profile ?? {}) as {
    audience?: string
    tone?: string
  }
  /* brandConfigSchema requires non-empty voice + audience; fall back to
   * the industry defaults so the doc always validates on read. */
  const voice = wizardProfile.tone?.trim() || defaults.toneHint
  const audience =
    wizardProfile.audience?.trim() || `${defaults.label} audience`
  const brandRef = db.doc(orgBrandConfigDocPath(orgId))
  const brandSnap = await brandRef.get()
  const brandPatch: Record<string, unknown> = {
    id: "default",
    organizationId: orgId,
    voice,
    audience,
    channels: brandChannels,
    updatedAt: now,
  }
  if (!brandSnap.exists) {
    brandPatch.targetCadence = { perWeek: 3, preferredDays: [], preferredTimes: [] }
    brandPatch.createdAt = now
  }
  await brandRef.set(brandPatch, { merge: true })

  revalidatePath("/calendar")
  revalidatePath("/settings/categories")
  revalidatePath("/settings/brand")
  revalidatePath("/library")
  revalidatePath("/", "layout")
  return { ok: true, id: orgId }
}

/*
 * Rebuilds an agent's systemPrompt from its (workspace-neutral) default in
 * lib/agents/defaults.ts plus a workspace-context block derived from the
 * wizard profile. Always starts from the default — never the stored
 * prompt — so re-running the wizard re-tailors cleanly instead of stacking
 * context blocks. Returns null for unknown agent names.
 */
function tailorAgentPrompt(
  agentName: string,
  ctx: { orgName: string; industryLabel: string; audience?: string; tone?: string },
): string | null {
  const base = getAgentDefault(agentName)?.systemPrompt
  if (!base) return null
  const lines = [
    base,
    "",
    "Workspace context (set by the setup wizard):",
    `  - Workspace: ${ctx.orgName}`,
    `  - Industry: ${ctx.industryLabel}`,
  ]
  if (ctx.audience?.trim()) lines.push(`  - Audience: ${ctx.audience.trim()}`)
  if (ctx.tone?.trim()) lines.push(`  - Voice & tone: ${ctx.tone.trim()}`)
  lines.push(
    "Honour this context in every post, idea, and plan you produce.",
  )
  return lines.join("\n")
}

function resolveCategoryForTemplate(
  lib: StarterTemplate,
  presentSlugs: Set<string>,
  fallback: string | undefined,
): string | undefined {
  if (presentSlugs.has(lib.preferredCategorySlug)) return lib.preferredCategorySlug
  return fallback
}

export async function completeOnboarding(
  input: unknown,
): Promise<ServerActionResult> {
  const parsed = completeInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  const orgId = await getCurrentOrgId()
  const completedAt = new Date().toISOString()
  await getAdminDb().doc(orgPath(orgId)).set(
    {
      onboarding: {
        completedAt,
        skippedSteps: parsed.data.skippedSteps,
      },
      updatedAt: completedAt,
    },
    { merge: true },
  )
  const actor = await getCurrentUser()
  await writeAuditEvent({
    orgId,
    kind: "onboarding.complete",
    actorUserId: actor?.id ?? null,
    target: { type: "organization", id: orgId },
    meta: { skippedSteps: parsed.data.skippedSteps },
  })
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

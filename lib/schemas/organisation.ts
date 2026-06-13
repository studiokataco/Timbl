import { z } from "zod"
import { audit } from "./_shared"
import { billingStatus } from "./billing"

export const organisationSchema = audit.extend({
  id: z.string(),
  name: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, digits, and hyphens only"),
  primaryColor: z.string().optional(),
  logoUrl: z.string().url().optional(),
  /* Plan id (e.g. "free_v1", "agency_v1"). Missing = agency_v1 during pilot.
   * Versioned ids let existing customers stay grandfathered
   * when we ship the v2 of a tier. See lib/plans/plans.ts. */
  plan: z.string().optional(),
  /* Billing/dunning state, stamped by the Razorpay webhook (and startTrial).
   * Mirrors the billing profile status; read alongside `plan` by the gate so
   * dunning + trial expiry need a single org-doc get. Missing = "manual". */
  billingStatus: billingStatus.optional(),
  /* 30-day no-card trial. `trialStartedAt` gates one trial per org;
   * `trialEndsAt` is when the trial tier reverts to Free (enforced lazily in
   * lib/plans/gate.ts). Both ISO strings. */
  trialStartedAt: z.string().optional(),
  trialEndsAt: z.string().optional(),
  /* Comped full-access cohort: orgs that existed before billing went live and
   * were grandfathered to the top tier "until further notice". The flag makes
   * the cohort targetable for a later policy change; set by
   * scripts/grandfather-existing-orgs.ts. */
  grandfathered: z.boolean().optional(),
  grandfatheredAt: z.string().optional(),
  /* Lifecycle status set from the control centre. A suspended org is blocked
   * at the (app) layer (requireActiveOrg) - it stays in Firestore, it just
   * can't be used until reactivated. Missing = active. `suspendedAt` (ISO)
   * is stamped on suspension, cleared on reactivation; suspended orgs are
   * permanently deleted 60 days after it (orgRetentionSweep). */
  status: z.enum(["active", "suspended"]).optional(),
  suspendedAt: z.string().optional(),
  /* Per-org quota overrides set from the control centre. Merged OVER the
   * plan's quotas in lib/plans/gate.ts. `null` for a metric = unlimited.
   * A metric absent here falls back to the plan default. */
  quotaOverrides: z
    .object({
      agentRuns: z.number().int().nullable().optional(),
      scheduledPosts: z.number().int().nullable().optional(),
      brands: z.number().int().nullable().optional(),
      seats: z.number().int().nullable().optional(),
    })
    .optional(),
  /* Onboarding state. `completedAt` set on wizard finish OR backfilled
   * for legacy orgs. Layout uses `completedAt` to decide whether to
   * redirect to /onboarding. `profile` is what the user typed at step
   * one - surfaces back into agent prompts for tone/audience grounding. */
  onboarding: z
    .object({
      completedAt: z.string().optional(),
      skippedSteps: z.array(z.string()).optional(),
      profile: z
        .object({
          industry: z.string().optional(),
          audience: z.string().optional(),
          tone: z.string().optional(),
          /* Channels the user said they care about (instagram, linkedin
           * etc). Authoritative channel-connection state lives elsewhere
           * once Phase 7 ships real auth. */
          channels: z.array(z.string()).optional(),
        })
        .optional(),
    })
    .optional(),
  /* Org-level AI settings (pluggable-providers phase).
   *  - embeddingModel: which 768-dim embedding model this org's vectors
   *    are produced with. Closed enum - Firestore's vector index is
   *    dimension-fixed, so only vetted 768-dim models may appear here.
   *    Today only `gemini-embedding-001` has a wired adapter;
   *    `google/embeddinggemma-300m` is the next candidate (§4.3) and gets
   *    added once its adapter + licence vetting land.
   *  - notifyModelUpdates: when true, the model-update check (§6.8) writes
   *    notifications for newer provider models. Off = agents stay pinned,
   *    no notifications - full stability. */
  aiConfig: z
    .object({
      embeddingModel: z
        .enum(["gemini-embedding-001"])
        .default("gemini-embedding-001"),
      notifyModelUpdates: z.boolean().default(true),
    })
    .optional(),
  /* Workspace reminder toasts; kinds map to getWorkspaceReminders. */
  reminderPreferences: z
    .object({
      enabled: z.boolean().default(true),
      approvalDue: z.boolean().default(true),
      overdue: z.boolean().default(true),
      goesLiveSoon: z.boolean().default(true),
      silentCategory: z.boolean().default(true),
      maxToastsPerSession: z.number().int().min(1).max(5).default(3),
      frequency: z.enum(["per-session", "once-per-day"]).default("per-session"),
      approvalHorizonDays: z.number().int().min(1).max(14).default(3),
      silentCategoryDays: z.number().int().min(7).max(90).default(14),
      goesLiveWindow: z
        .enum(["today", "today-and-tomorrow"])
        .default("today-and-tomorrow"),
      overdueIncludeDraft: z.boolean().default(true),
      overdueIncludeScheduled: z.boolean().default(true),
    })
    .optional(),
  /* Per-org boolean feature flags toggled from the control centre or seed.
   * A missing key is treated as `false`. Current known key: `public_api_v1`. */
  featureFlags: z.record(z.string(), z.boolean()).optional(),
})
export type Organisation = z.infer<typeof organisationSchema>

export function hasFeatureFlag(
  org: Partial<Pick<Organisation, "featureFlags">>,
  flag: string,
): boolean {
  return org.featureFlags?.[flag] === true
}

export const reminderPreferencesSchema = z.object({
  enabled: z.boolean(),
  approvalDue: z.boolean(),
  overdue: z.boolean(),
  goesLiveSoon: z.boolean(),
  silentCategory: z.boolean(),
  maxToastsPerSession: z.number().int().min(1).max(5),
  frequency: z.enum(["per-session", "once-per-day"]),
  approvalHorizonDays: z.number().int().min(1).max(14),
  silentCategoryDays: z.number().int().min(7).max(90),
  goesLiveWindow: z.enum(["today", "today-and-tomorrow"]),
  overdueIncludeDraft: z.boolean(),
  overdueIncludeScheduled: z.boolean(),
})
export type ReminderPreferences = z.infer<typeof reminderPreferencesSchema>

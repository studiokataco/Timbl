import { z } from "zod"

/*
 * Enums shared across schemas. Mirrored in firestore.rules where rules
 * actively check string membership.
 */

/*
 * post.status used to be a closed enum. It's now a free string referring to
 * a `kanbanColumns` document id, so users can add custom columns. The legacy
 * 9 values are kept as `LEGACY_POST_STATUSES` for components that need a
 * fallback before column data has loaded (e.g. status glyphs).
 */
export const postStatus = z.string().min(1)
export type PostStatus = z.infer<typeof postStatus>

export const LEGACY_POST_STATUSES = [
  "idea",
  "brief",
  "researching",
  "designing",
  "review",
  "scheduled",
  "posted",
  "missed",
  "archived",
] as const
export type LegacyPostStatus = (typeof LEGACY_POST_STATUSES)[number]

/*
 * Statuses the publishing pipeline depends on by id (publish.ts, scheduler,
 * public API). They can be renamed, recolored, and reordered, but not deleted
 * - removing them would orphan scheduling and publishing logic.
 */
export const PROTECTED_STATUS_IDS = ["scheduled", "posted"] as const
export function isProtectedStatusId(id: string): boolean {
  return (PROTECTED_STATUS_IDS as readonly string[]).includes(id)
}

export const postType = z.enum(["grid", "carousel", "reel", "story", "video"])
export type PostType = z.infer<typeof postType>

export const userRole = z.enum(["admin", "editor", "contributor"])
export type UserRole = z.infer<typeof userRole>

export const channelKey = z.enum([
  "instagram",
  "facebook",
  "linkedin",
  "website",
  "fb_groups",
  "x",
])
export type ChannelKey = z.infer<typeof channelKey>

export const channelStatus = z.enum([
  "n/a",
  "scheduled",
  "published",
  "failed",
])
export type ChannelStatus = z.infer<typeof channelStatus>

/*
 * Where a design/reference link points. Detected from the pasted URL host in
 * lib/url.ts; `link` is the catch-all for anything that isn't a recognized
 * storage app. Storage-app connections key off the same provider slugs.
 */
export const linkProvider = z.enum([
  "canva",
  "gdrive",
  "dropbox",
  "onedrive",
  "link",
])
export type LinkProvider = z.infer<typeof linkProvider>

/*
 * Cloud-storage apps an org can connect via OAuth. Slugs intentionally
 * overlap with linkProvider so a connected account and a pasted link from the
 * same app share an identity.
 */
export const storageProvider = z.enum(["gdrive", "dropbox", "onedrive"])
export type StorageProvider = z.infer<typeof storageProvider>

/*
 * Firestore stores dates as Timestamps; at the application boundary we use
 * ISO strings (`YYYY-MM-DD` for dates, full ISO for timestamps) so schemas are
 * portable to and from forms/URLs without converter gymnastics.
 */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
export const isoTimestamp = z.string().datetime({ offset: true })
export const isoTime = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Expected HH:MM or HH:MM:SS")

/*
 * Document audit fields written on every server action. createdAt is set
 * once; updatedAt on every write.
 */
export const audit = z.object({
  createdAt: isoTimestamp.optional(),
  updatedAt: isoTimestamp.optional(),
})

/*
 * nextAction declares what should happen when a human approves an
 * agent-produced artifact (a post draft, an ideation item, a calendar
 * suggestion, a template proposal). The producing agent sets it at creation
 * time; the approveItem dispatcher reads it and runs the matching resolver.
 *
 * `noop` is the legacy default - existing rows without a next_action are
 * treated as "approve = status change only", preserving today's behavior.
 *
 * Producers are responsible for populating the payload fields they need; the
 * resolver in lib/actions/approvals.ts validates shape per-kind before
 * dispatching to the corresponding existing server action.
 */
export const nextActionKind = z.enum([
  "create_draft",
  "schedule_post",
  "instantiate_template",
  "add_to_calendar",
  "assign_review",
  "regenerate",
  "noop",
])
export type NextActionKind = z.infer<typeof nextActionKind>

export const nextActionSchema = z.object({
  kind: nextActionKind,
  /* Free-form per-kind data (templateId, briefText, mediaRefs, etc.).
   * Validated by the resolver, not by this schema, to keep producer agents
   * unblocked when adding new payload fields. */
  payload: z.record(z.string(), z.unknown()).optional(),
  targetChannel: z.string().optional(),
  /* ISO timestamp or the literal 'auto' to slot via category cadence rules. */
  targetTime: z.union([isoTimestamp, z.literal("auto")]).optional(),
  categoryId: z.string().optional(),
  /* Set when approval should re-link to an existing artifact rather than
   * create a new one (e.g. re-approving a regenerated draft). */
  linkedArtifactId: z.string().optional(),
})
export type NextAction = z.infer<typeof nextActionSchema>

/*
 * Canned rejection reasons surfaced when a reviewer rejects an agent draft.
 * Free-text notes fall into `reasonNote`; `REJECT_REASON_LABELS` maps each
 * key to its display string. These live here rather than in the
 * agent-suggestions "use server" action file - a "use server" module may
 * only export async functions, so runtime consts have to live elsewhere.
 */
export const REJECT_REASONS = [
  "off_brand",
  "wrong_timing",
  "already_covered",
  "factual_issue",
  "other",
] as const
export type RejectReason = (typeof REJECT_REASONS)[number]

export const REJECT_REASON_LABELS: Record<RejectReason, string> = {
  off_brand: "Off-brand",
  wrong_timing: "Wrong timing",
  already_covered: "Already covered",
  factual_issue: "Factual issue",
  other: "Other",
}

/*
 * Canonical shape returned by every server action. `id` is set on successful
 * creates/updates so callers can navigate or revalidate. Actions that need
 * extra fields (e.g. agent-suggestions surfacing a resumeRunId) extend this
 * type locally via intersection.
 */
export const serverActionResult = z.object({
  ok: z.boolean(),
  id: z.string().optional(),
  error: z.string().optional(),
  /* Set when the action was blocked by a plan gate. Lets the client
   * render a context-aware upgrade prompt without a second round-trip.
   * Shape mirrors lib/plans/gate.ts PlanGateReason. */
  gate: z
    .union([
      z.object({
        kind: z.literal("feature"),
        feature: z.string(),
        currentTier: z.string(),
      }),
      z.object({
        kind: z.literal("quota"),
        metric: z.string(),
        limit: z.number(),
        used: z.number(),
        currentTier: z.string(),
      }),
    ])
    .optional(),
})
export type ServerActionResult = z.infer<typeof serverActionResult>

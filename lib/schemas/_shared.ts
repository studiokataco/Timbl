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
 * Canonical shape returned by every server action. `id` is set on successful
 * creates/updates so callers can navigate or revalidate. Actions that need
 * extra fields (e.g. agent-suggestions surfacing a resumeRunId) extend this
 * type locally via intersection.
 */
export const serverActionResult = z.object({
  ok: z.boolean(),
  id: z.string().optional(),
  error: z.string().optional(),
})
export type ServerActionResult = z.infer<typeof serverActionResult>

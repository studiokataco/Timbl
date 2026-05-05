import { z } from "zod"

/*
 * Enums shared across schemas. Mirrored in firestore.rules where rules
 * actively check string membership.
 */

export const postStatus = z.enum([
  "idea",
  "brief",
  "researching",
  "designing",
  "review",
  "scheduled",
  "posted",
  "missed",
  "archived",
])
export type PostStatus = z.infer<typeof postStatus>

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

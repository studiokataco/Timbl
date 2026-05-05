import { z } from "zod"
import {
  audit,
  channelKey,
  channelStatus,
  isoDate,
  isoTime,
  isoTimestamp,
  postStatus,
  postType,
} from "./_shared"

/*
 * channelStatuses is a sparse map. Keys are channel slugs (`instagram`,
 * `facebook`, `linkedin`, `website`, `fb_groups`); values are either a
 * status string or, for `fb_groups`, an array of group slugs that have been
 * cross-posted. We use string keys at the schema boundary and trust the
 * application layer to write only known channel keys.
 */
export const channelStatusesSchema = z.record(
  z.string(),
  z.union([channelStatus, z.array(z.string())]),
)
export type ChannelStatuses = z.infer<typeof channelStatusesSchema>
export type { ChannelKey, ChannelStatus } from "./_shared"
void channelKey

export const migratedFromSchema = z.object({
  sourceTab: z.string(),
  sourceRow: z.number().int().nonnegative(),
  sourceHash: z.string(),
})
export type MigratedFrom = z.infer<typeof migratedFromSchema>

export const postSchema = audit.extend({
  id: z.string(),
  organizationId: z.string(),

  scheduledDate: isoDate,
  scheduledTime: isoTime.optional(),
  status: postStatus.default("idea"),

  categoryId: z.string().optional(),
  campaignId: z.string().optional(),
  templateId: z.string().optional(),
  awarenessDayId: z.string().optional(),
  eventId: z.string().optional(),

  postType: postType.default("grid"),

  brief: z.string().optional(),
  detailedBrief: z.string().optional(),
  blurb: z.string().optional(),
  hashtags: z.array(z.string()).default([]),
  pagesToTag: z.string().optional(),
  ctaId: z.string().optional(),

  leadUserId: z.string().optional(),
  assigneeId: z.string().optional(),
  blurbAuthorId: z.string().optional(),

  canvaUrl: z.string().url().optional(),
  assetUrls: z.array(z.string().url()).default([]),

  channelStatuses: channelStatusesSchema.default({}),

  notes: z.string().optional(),
  postedAt: isoTimestamp.optional(),
  migratedFrom: migratedFromSchema.optional(),
})
export type Post = z.infer<typeof postSchema>

/*
 * Quick-add captures the irreducible minimum. Everything else inherits from
 * the selected category's defaults. Validated client-side and reused by the
 * server action.
 */
export const quickAddPostSchema = z.object({
  scheduledDate: isoDate,
  categoryId: z.string().min(1),
  brief: z.string().min(1).max(280),
})
export type QuickAddPostInput = z.infer<typeof quickAddPostSchema>

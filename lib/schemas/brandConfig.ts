import { z } from "zod"
import { audit, channelKey, isoTime } from "./_shared"

/*
 * The single doc that anchors every workflow agent. Captures voice, channels,
 * cadence, audience description, and explicit do/don'ts so the drafter,
 * reviewer, scheduler, and ideator can all read one source of truth.
 *
 * Stored at /organizations/{orgId}/brandConfig/default - keyed by a fixed
 * doc id because there is exactly one brand per org. If we ever support
 * multi-brand orgs, switch to /brandConfig/{brandId} without changing the
 * schema shape.
 */

export const weekday = z.enum([
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
])
export type Weekday = z.infer<typeof weekday>

export const cadenceSchema = z.object({
  perWeek: z.number().int().min(1).max(50),
  preferredDays: z.array(weekday).default([]),
  preferredTimes: z.array(isoTime).default([]),
})
export type Cadence = z.infer<typeof cadenceSchema>

export const samplePostSchema = z.object({
  text: z.string().min(1).max(2_000),
  tag: z.string().max(64).optional(),
})
export type SamplePost = z.infer<typeof samplePostSchema>

export const brandConfigSchema = audit.extend({
  id: z.literal("default").default("default"),
  organizationId: z.string(),

  voice: z.string().min(1).max(4_000),
  audience: z.string().min(1).max(4_000),
  channels: z.array(channelKey).default([]),
  targetCadence: cadenceSchema,
  forbiddenTopics: z.array(z.string().max(120)).default([]),
  samplePosts: z.array(samplePostSchema).default([]),

  /* Free-form notes the wizard or settings-assistant may capture. */
  notes: z.string().max(8_000).optional(),
})
export type BrandConfig = z.infer<typeof brandConfigSchema>

/* Patch shape - every field optional so the wizard can write incrementally
 * as it converges through the interview. */
export const brandConfigPatchSchema = brandConfigSchema
  .partial()
  .omit({ id: true, organizationId: true })
export type BrandConfigPatch = z.infer<typeof brandConfigPatchSchema>

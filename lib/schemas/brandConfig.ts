import { z } from "zod"
import { audit, channelKey, isoTime, toPatchSchema } from "./_shared"

/*
 * A brand: voice, channels, cadence, audience, and explicit do/don'ts, read as
 * one source of truth by the drafter, reviewer, scheduler and ideator.
 *
 * Lives at /organizations/{orgId}/brands/{brandId}. Every org has at least the
 * DEFAULT_BRAND_ID brand; agencies add more. Legacy docs at
 * /brandConfig/default migrate to /brands/default with the same shape plus a
 * display `name`, so `default` stays a valid id string.
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
  id: z.string().default("default"),
  organizationId: z.string(),
  name: z.string().min(1).max(120).default("Default brand"),
  avatarUrl: z.string().url().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),

  /* Empty until the wizard fills them - a freshly created brand is a shell an
   * agency configures afterwards, so these cannot be min(1) or the shell would
   * fail parse and vanish from listBrands. */
  voice: z.string().max(4_000).default(""),
  audience: z.string().max(4_000).default(""),
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
export const brandConfigPatchSchema = toPatchSchema(
  brandConfigSchema.omit({ id: true, organizationId: true }),
)
export type BrandConfigPatch = z.infer<typeof brandConfigPatchSchema>

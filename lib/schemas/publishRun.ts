import { z } from "zod"
import { channelKey, isoTimestamp } from "./_shared"

/* Per-attempt publish telemetry, mirroring agentRuns minimally so the
 * Studio history pattern extends to publishing. */
export const publishRunKind = z.enum([
  "ok",
  "retry",
  "bad_body",
  "needs_reauth",
  "error",
])
export type PublishRunKind = z.infer<typeof publishRunKind>

export const publishRunSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  brandId: z.string().default("default"),
  postId: z.string(),
  channel: channelKey,
  kind: publishRunKind,
  reason: z.string().optional(),
  externalId: z.string().optional(),
  latencyMs: z.number().int().nonnegative(),
  at: isoTimestamp,
})
export type PublishRun = z.infer<typeof publishRunSchema>

import { z } from "zod"
import { audit, isoDate, nextActionSchema } from "./_shared"

export const ideationStatus = z.enum(["new", "used", "dismissed"])
export type IdeationStatus = z.infer<typeof ideationStatus>

export const ideationItemSchema = audit.extend({
  id: z.string(),
  organizationId: z.string(),

  title: z.string().min(1).max(280),
  summary: z.string().max(4_000),
  sourceUrls: z.array(z.string().url()).default([]),

  suggestedDate: isoDate.optional(),
  awarenessDayId: z.string().optional(),

  status: ideationStatus.default("new"),
  confidence: z.number().min(0).max(1).default(0.5),

  createdByRunId: z.string(),
  promotedPostId: z.string().optional(),
  /* What approveItem should do when a human accepts this idea (typically
   * 'create_draft' with title/summary as payload). */
  nextAction: nextActionSchema.optional(),
})
export type IdeationItem = z.infer<typeof ideationItemSchema>

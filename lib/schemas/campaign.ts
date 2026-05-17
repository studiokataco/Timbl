import { z } from "zod"
import { audit, isoDate } from "./_shared"
import { embeddingSchema } from "./embedding"

export const campaignStatus = z.enum(["active", "completed", "archived"])
export type CampaignStatus = z.infer<typeof campaignStatus>

export const campaignSchema = audit.extend({
  id: z.string(),
  organizationId: z.string(),
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  status: campaignStatus.default("active"),
  embedding: embeddingSchema.optional(),
})
export type Campaign = z.infer<typeof campaignSchema>

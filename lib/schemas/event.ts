import { z } from "zod"
import { audit, isoDate } from "./_shared"

export const eventSchema = audit.extend({
  id: z.string(),
  organizationId: z.string(),
  name: z.string().min(1),
  startDate: isoDate,
  endDate: isoDate.optional(),
  location: z.string().optional(),
  organizer: z.string().optional(),
  organizerUrl: z.string().url().optional(),
  campaignId: z.string().optional(),
  isSafeRun: z.boolean().default(false),
})
export type Event = z.infer<typeof eventSchema>

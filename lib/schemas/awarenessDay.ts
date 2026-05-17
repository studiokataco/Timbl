import { z } from "zod"
import { audit, isoDate } from "./_shared"
import { embeddingSchema } from "./embedding"

export const awarenessImportance = z.enum(["low", "medium", "high"])
export type AwarenessImportance = z.infer<typeof awarenessImportance>

export const awarenessRecurrence = z.enum([
  "annual",
  "weekly",
  "fixed-date",
  "custom",
])
export type AwarenessRecurrence = z.infer<typeof awarenessRecurrence>

export const awarenessDaySchema = audit.extend({
  id: z.string(),
  date: isoDate,
  name: z.string().min(1),
  description: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  importance: awarenessImportance.default("medium"),
  recurringPattern: awarenessRecurrence.default("annual"),
  /** Default category slug to suggest when promoting this day to a post. */
  suggestedCategorySlug: z.string().optional(),
  embedding: embeddingSchema.optional(),
})
export type AwarenessDay = z.infer<typeof awarenessDaySchema>

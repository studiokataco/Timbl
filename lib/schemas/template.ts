import { z } from "zod"
import { audit, postType } from "./_shared"
import { embeddingSchema } from "./embedding"

export const templateCadence = z.enum([
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "ad-hoc",
])
export type TemplateCadence = z.infer<typeof templateCadence>

export const templateSchema = audit.extend({
  id: z.string(),
  organizationId: z.string(),
  name: z.string().min(1),
  categoryId: z.string(),
  defaultPostType: postType.default("grid"),
  defaultHashtags: z.array(z.string()).default([]),
  defaultCtaId: z.string().optional(),
  blurbTemplate: z.string().optional(),
  designTemplateCanvaUrl: z.string().url().optional(),
  cadence: templateCadence.default("ad-hoc"),
  embedding: embeddingSchema.optional(),
})
export type Template = z.infer<typeof templateSchema>

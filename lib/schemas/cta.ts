import { z } from "zod"
import { audit } from "./_shared"

export const ctaSchema = audit.extend({
  id: z.string(),
  organizationId: z.string(),
  label: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
})
export type Cta = z.infer<typeof ctaSchema>

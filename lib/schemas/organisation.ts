import { z } from "zod"
import { audit } from "./_shared"

export const organisationSchema = audit.extend({
  id: z.string(),
  name: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, digits, and hyphens only"),
  primaryColor: z.string().optional(),
  logoUrl: z.string().url().optional(),
})
export type Organisation = z.infer<typeof organisationSchema>

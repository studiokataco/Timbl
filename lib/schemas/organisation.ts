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
  /* Plan id (e.g. "free_v1", "agency_v1"). Missing = free_v1 via
   * getPlan(). Versioned ids let existing customers stay grandfathered
   * when we ship the v2 of a tier. See lib/plans/plans.ts. */
  plan: z.string().optional(),
})
export type Organisation = z.infer<typeof organisationSchema>

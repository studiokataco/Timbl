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
  /* Onboarding state. `completedAt` set on wizard finish OR backfilled
   * for legacy orgs. Layout uses `completedAt` to decide whether to
   * redirect to /onboarding. `profile` is what the user typed at step
   * one — surfaces back into agent prompts for tone/audience grounding. */
  onboarding: z
    .object({
      completedAt: z.string().optional(),
      skippedSteps: z.array(z.string()).optional(),
      profile: z
        .object({
          industry: z.string().optional(),
          audience: z.string().optional(),
          tone: z.string().optional(),
          /* Channels the user said they care about (instagram, linkedin
           * etc). Authoritative channel-connection state lives elsewhere
           * once Phase 7 ships real auth. */
          channels: z.array(z.string()).optional(),
        })
        .optional(),
    })
    .optional(),
})
export type Organisation = z.infer<typeof organisationSchema>

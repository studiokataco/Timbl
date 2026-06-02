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
  /* Plan id (e.g. "free_v1", "agency_v1"). Missing = agency_v1 during pilot.
   * Versioned ids let existing customers stay grandfathered
   * when we ship the v2 of a tier. See lib/plans/plans.ts. */
  plan: z.string().optional(),
  /* Onboarding state. `completedAt` set on wizard finish OR backfilled
   * for legacy orgs. Layout uses `completedAt` to decide whether to
   * redirect to /onboarding. `profile` is what the user typed at step
   * one - surfaces back into agent prompts for tone/audience grounding. */
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
  /* Org-level AI settings (pluggable-providers phase).
   *  - embeddingModel: which 768-dim embedding model this org's vectors
   *    are produced with. Closed enum - Firestore's vector index is
   *    dimension-fixed, so only vetted 768-dim models may appear here.
   *    Today only `gemini-embedding-001` has a wired adapter;
   *    `google/embeddinggemma-300m` is the next candidate (§4.3) and gets
   *    added once its adapter + licence vetting land.
   *  - notifyModelUpdates: when true, the model-update check (§6.8) writes
   *    notifications for newer provider models. Off = agents stay pinned,
   *    no notifications - full stability. */
  aiConfig: z
    .object({
      embeddingModel: z
        .enum(["gemini-embedding-001"])
        .default("gemini-embedding-001"),
      notifyModelUpdates: z.boolean().default(true),
    })
    .optional(),
})
export type Organisation = z.infer<typeof organisationSchema>

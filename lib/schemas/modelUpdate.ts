import { z } from "zod"
import { audit, isoTimestamp } from "./_shared"
import { agentProvider } from "./agentConfig"

/*
 * A model-update notification — one provider model that the bi-weekly
 * (or manual) check found and that is NOT already in use or in the §4
 * shortlist. Notify-only: nothing here is auto-applied. A human reviews
 * it, then optionally swaps an agent's model in Studio and prod-swap A/Bs.
 *
 * Docs live at organizations/{orgId}/modelUpdates/{modelId-slugified}.
 * The per-org `aiConfig.notifyModelUpdates` toggle gates whether the check
 * writes these at all.
 */

export const modelUpdateSchema = audit.extend({
  id: z.string(),
  organizationId: z.string(),
  provider: agentProvider,
  /** Exact provider model ID, e.g. `z-ai/glm-5.1`, `gemini-3.5-flash`. */
  modelId: z.string().min(1),
  /** When the check first surfaced this model. */
  detectedAt: isoTimestamp,
  /** Operator dismissed the notification — kept so it isn't re-flagged. */
  dismissed: z.boolean().default(false),
})
export type ModelUpdate = z.infer<typeof modelUpdateSchema>

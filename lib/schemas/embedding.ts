import { z } from "zod"

/*
 * Per-doc embedding payload. Attached to any kind we want similarity over:
 * posts, campaigns, templates, awareness days, agent memory.
 *
 * `sourceHash` is sha1(toEmbeddingText(kind, doc)). The write path skips
 * re-embedding when the hash matches what's already on the doc - re-running
 * the backfill or saving a doc without touching its semantic fields makes
 * zero provider calls.
 */
export const embeddingSchema = z.object({
  vector: z.array(z.number()),
  dim: z.number().int().positive(),
  model: z.string(),
  sourceHash: z.string(),
  updatedAt: z.string().datetime({ offset: true }),
})
export type Embedding = z.infer<typeof embeddingSchema>

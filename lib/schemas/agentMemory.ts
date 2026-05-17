import { z } from "zod"
import { isoTimestamp } from "./_shared"
import { embeddingSchema } from "./embedding"

/*
 * Lightweight memory facts an agent writes (typically via human-gate) and
 * any other agent recalls. Intentionally minimal — no `kind`, `confidence`,
 * or `supersedes` yet. Add fields back when signal earns them.
 */
export const agentMemorySchema = z.object({
  id: z.string(),
  topic: z.string().min(1),
  body: z.string().min(1),
  createdAt: isoTimestamp,
  embedding: embeddingSchema.optional(),
})
export type AgentMemory = z.infer<typeof agentMemorySchema>

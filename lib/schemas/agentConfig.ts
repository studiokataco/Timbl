import { z } from "zod"
import { audit } from "./_shared"

export const agentProvider = z.enum([
  "gemini",
  "anthropic",
  "openrouter",
  "ollama",
  "mock",
])
export type AgentProvider = z.infer<typeof agentProvider>

export const agentRole = z.enum(["config", "workflow"])
export type AgentRole = z.infer<typeof agentRole>

/* Context compaction (ADK contextCompactors). When a session's event
 * history crosses `tokenThreshold`, the oldest events are summarised into a
 * single compacted event before the next model call - so a long run (or a
 * draft->review loop) stops re-sending the whole transcript every turn.
 * Defaults are tuned high enough that short runs never trigger it. */
export const agentCompactionSchema = z
  .object({
    enabled: z.boolean().default(true),
    tokenThreshold: z.number().int().min(2_000).max(500_000).default(16_000),
    eventRetentionSize: z.number().int().min(1).max(50).default(6),
  })
  .default({ enabled: true, tokenThreshold: 16_000, eventRetentionSize: 6 })
export type AgentCompaction = z.infer<typeof agentCompactionSchema>

export const agentBudgetsSchema = z.object({
  maxLlmCalls: z.number().int().min(1).max(500).default(40),
  maxToolCalls: z.number().int().min(0).max(500).default(60),
  maxUsdCost: z.number().nonnegative().max(50).default(2),
  maxReviewLoops: z.number().int().min(0).max(10).default(3),
  monthlyUsdCap: z.number().nonnegative().max(2_000).default(50),
})
export type AgentBudgets = z.infer<typeof agentBudgetsSchema>

export const agentConfigSchema = audit.extend({
  id: z.string(),
  organizationId: z.string(),
  name: z.string().min(1),
  role: agentRole,
  description: z.string().max(2_000).optional(),

  provider: agentProvider.default("gemini"),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2).default(0.7),
  systemPrompt: z.string().max(20_000),

  enabled: z.boolean().default(true),
  /** Cron expression - only consulted when triggers.cron is true.
   * Nullable because seed 0007 explicitly writes `null` for unscheduled
   * agents so the field exists at write time (Firestore allows queries
   * like `where('schedule', '!=', null)` only when the field is present). */
  schedule: z.string().nullable().optional(),
  allowedTools: z.array(z.string()).default([]),
  budgets: agentBudgetsSchema.default({
    maxLlmCalls: 40,
    maxToolCalls: 60,
    maxUsdCost: 2,
    maxReviewLoops: 3,
    monthlyUsdCap: 50,
  }),
  triggers: z
    .object({
      manual: z.boolean().default(true),
      cron: z.boolean().default(false),
      systemUserId: z.string().default("system"),
    })
    .default({ manual: true, cron: false, systemUserId: "system" }),
  compaction: agentCompactionSchema,
})
export type AgentConfig = z.infer<typeof agentConfigSchema>

export const agentConfigPatchSchema = agentConfigSchema
  .partial()
  .omit({ id: true, organizationId: true, name: true, role: true })
export type AgentConfigPatch = z.infer<typeof agentConfigPatchSchema>

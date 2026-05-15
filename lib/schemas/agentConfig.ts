import { z } from "zod"
import { audit } from "./_shared"

export const agentProvider = z.enum(["gemini", "anthropic", "mock"])
export type AgentProvider = z.infer<typeof agentProvider>

export const agentRole = z.enum(["config", "workflow"])
export type AgentRole = z.infer<typeof agentRole>

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
  /** Cron expression — only consulted when triggers.cron is true. */
  schedule: z.string().optional(),
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
})
export type AgentConfig = z.infer<typeof agentConfigSchema>

export const agentConfigPatchSchema = agentConfigSchema
  .partial()
  .omit({ id: true, organizationId: true, name: true, role: true })
export type AgentConfigPatch = z.infer<typeof agentConfigPatchSchema>

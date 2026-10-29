import { z } from "zod"
import cronstrue from "cronstrue"

export const scheduleModes = ["manual", "daily", "weekdays", "weekly", "custom"] as const

export const agentSettingsFormSchema = z
  .object({
    scheduleMode: z.enum(scheduleModes),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Pick a time"),
    weekday: z.number().int().min(0).max(6),
    cron: z.string(),
    manual: z.boolean(),
    temperature: z.number().min(0).max(2),
    systemPrompt: z.string().max(20_000, "Keep instructions under 20,000 characters"),
    allowedTools: z.array(z.string()),
    budgets: z.object({
      maxLlmCalls: z.number().int().min(1).max(500),
      maxToolCalls: z.number().int().min(0).max(500),
      maxUsdCost: z.number().nonnegative().max(50),
      maxReviewLoops: z.number().int().min(0).max(10),
      monthlyUsdCap: z.number().nonnegative().max(2_000),
    }),
  })
  .superRefine((v, ctx) => {
    if (v.scheduleMode !== "custom") return
    try {
      cronstrue.toString(v.cron.trim(), { throwExceptionOnParseError: true })
    } catch {
      ctx.addIssue({ code: "custom", path: ["cron"], message: "That isn't a valid cron expression" })
    }
  })

export type AgentSettingsForm = z.infer<typeof agentSettingsFormSchema>

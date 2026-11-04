import { z } from "zod"
import { audit, isoTimestamp } from "./_shared"

export const assistantThreadEntrySchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  text: z.string().optional(),
  createdAt: z.number().int(),
})
export type AssistantThreadEntry = z.infer<typeof assistantThreadEntrySchema>

export const assistantThreadSchema = audit.extend({
  id: z.string(),
  organizationId: z.string(),
  title: z.string().optional(),
  sessionId: z.string().optional(),
  transcript: z.array(assistantThreadEntrySchema).default([]),
  idbMigratedAt: isoTimestamp.optional(),
})
export type AssistantThread = z.infer<typeof assistantThreadSchema>

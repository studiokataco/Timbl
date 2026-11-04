import { z } from "zod"
import { audit, isoTimestamp } from "./_shared"

export const assistantThreadEntrySchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  text: z.string().optional(),
  createdAt: z.number().int(),
  planRunId: z.string().optional(),
})

const shellRunStepSchema = z.object({
  id: z.string(),
  toolName: z.string(),
  label: z.string(),
  doneLabel: z.string(),
  state: z.enum(["pending", "running", "done", "failed", "cancelled"]),
  error: z.string().optional(),
  startedAt: z.number().optional(),
  finishedAt: z.number().optional(),
})

export const shellRunSchema = z.object({
  id: z.string(),
  kind: z.enum(["ideas", "plan", "create", "refine", "advice", "chat"]),
  title: z.string(),
  status: z.enum(["proposed", "running", "needs_you", "done", "error", "cancelled"]),
  steps: z.array(shellRunStepSchema),
  agent: z.string(),
  input: z.string(),
  postId: z.string().optional(),
  refine: z.enum(["shorter", "funnier", "new_image"]).optional(),
  postIds: z.array(z.string()).optional(),
  error: z.string().optional(),
  serverRunId: z.string().optional(),
  startedAt: z.number().optional(),
  finishedAt: z.number().optional(),
})
export type AssistantThreadEntry = z.infer<typeof assistantThreadEntrySchema>

export const assistantThreadSchema = audit.extend({
  id: z.string(),
  organizationId: z.string(),
  title: z.string().optional(),
  sessionId: z.string().optional(),
  transcript: z.array(assistantThreadEntrySchema).default([]),
  skippedPostIds: z.array(z.string()).default([]),
  run: shellRunSchema.nullable().optional(),
  idbMigratedAt: isoTimestamp.optional(),
})
export type AssistantThread = z.infer<typeof assistantThreadSchema>

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

export const assistantThreadVisibility = z.enum(["private", "workspace"])
export type AssistantThreadVisibility = z.infer<typeof assistantThreadVisibility>

export const assistantThreadSchema = audit.extend({
  id: z.string(),
  organizationId: z.string(),
  title: z.string().optional(),
  titleSource: z.enum(["auto", "user"]).optional(),
  autoTitle: z.string().optional(),
  sessionId: z.string().optional(),
  transcript: z.array(assistantThreadEntrySchema).default([]),
  skippedPostIds: z.array(z.string()).default([]),
  run: shellRunSchema.nullable().optional(),
  idbMigratedAt: isoTimestamp.optional(),
  ownerId: z.string().optional(),
  visibility: assistantThreadVisibility.optional(),
  pinnedBy: z.array(z.string()).default([]),
  archivedAt: isoTimestamp.optional(),
  readAt: z.record(z.string(), z.number()).default({}),
  lastMessageAt: z.number().int().optional(),
  lastAssistantAt: z.number().int().optional(),
})
export type AssistantThread = z.infer<typeof assistantThreadSchema>

export const assistantThreadListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  lastAt: z.number(),
  mine: z.boolean(),
  visibility: assistantThreadVisibility,
  pinned: z.boolean(),
  archived: z.boolean(),
  unread: z.boolean(),
  needsYou: z.boolean(),
  running: z.boolean(),
})
export type AssistantThreadListItem = z.infer<typeof assistantThreadListItemSchema>

export const assistantThreadPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    pinned: z.boolean().optional(),
    archived: z.boolean().optional(),
    visibility: assistantThreadVisibility.optional(),
    read: z.literal(true).optional(),
  })
  .refine((patch) => Object.values(patch).some((value) => value !== undefined), { message: "Nothing to update" })
export type AssistantThreadPatch = z.infer<typeof assistantThreadPatchSchema>

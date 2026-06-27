import { z } from "zod"
import { isoTimestamp } from "./_shared"

export const checklistItemSchema = z.object({
  id: z.string(),
  postId: z.string(),
  label: z.string().min(1).max(500),
  done: z.boolean().default(false),
  sortOrder: z.number().int().nonnegative().default(0),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})
export type ChecklistItem = z.infer<typeof checklistItemSchema>

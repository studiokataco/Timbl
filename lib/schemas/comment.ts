import { z } from "zod"
import { isoTimestamp } from "./_shared"

export const commentSchema = z.object({
  id: z.string(),
  postId: z.string(),
  authorId: z.string(),
  body: z.string().min(1).max(10_000),
  isInternal: z.boolean().default(false),
  parentId: z.string().optional(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})
export type Comment = z.infer<typeof commentSchema>

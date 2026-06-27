import { z } from "zod"
import { isoTimestamp } from "./_shared"

export const postActivityTypeSchema = z.enum([
  "created", "status", "dates", "priority", "assignee",
  "category", "hashtags", "attachment", "comment", "follow", "edit",
])
export type PostActivityType = z.infer<typeof postActivityTypeSchema>

export const postActivitySchema = z.object({
  id: z.string(),
  postId: z.string(),
  actorId: z.string(),
  type: postActivityTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  createdAt: isoTimestamp,
})
export type PostActivity = z.infer<typeof postActivitySchema>

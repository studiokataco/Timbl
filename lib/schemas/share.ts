import { z } from "zod"
import { isoTimestamp } from "./_shared"

export const shareSchema = z.object({
  id: z.string(),
  postId: z.string(),
  mode: z.enum(["private", "link", "public"]),
  role: z.enum(["view", "comment", "edit"]),
  token: z.string(),
  expiresAt: isoTimestamp.optional(),
  createdAt: isoTimestamp,
})
export type Share = z.infer<typeof shareSchema>

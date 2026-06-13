import { z } from "zod"
import { audit } from "./_shared"

export const messageSchema = audit.extend({
  id: z.string(),
  organizationId: z.string(),
  conversationId: z.string(),
  direction: z.enum(["in", "out"]),
  body: z.string(),
  mediaUrls: z.array(z.string().url()).default([]),
  externalMessageId: z.string(),
  sentAt: z.string(),
  authorUserId: z.string().optional(),
})
export type Message = z.infer<typeof messageSchema>

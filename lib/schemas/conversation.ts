import { z } from "zod"
import { audit, channelKey } from "./_shared"

export const conversationStatusSchema = z.enum(["open", "pending", "resolved", "spam"])
export type ConversationStatus = z.infer<typeof conversationStatusSchema>

export const conversationSchema = audit.extend({
  id: z.string(),
  organizationId: z.string(),
  channel: channelKey,
  externalThreadId: z.string(),
  participantHandle: z.string(),
  lastMessageAt: z.string(),
  status: conversationStatusSchema.default("open"),
})
export type Conversation = z.infer<typeof conversationSchema>

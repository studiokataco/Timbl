import { z } from "zod"
import { audit } from "./_shared"

export const assignmentSchema = audit.extend({
  id: z.string(),
  organizationId: z.string(),
  conversationId: z.string(),
  assigneeUserId: z.string(),
  assignedAt: z.string(),
  assignedByUserId: z.string(),
})
export type Assignment = z.infer<typeof assignmentSchema>

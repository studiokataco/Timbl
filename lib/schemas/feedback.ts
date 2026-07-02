import { z } from "zod"

import { isoTimestamp } from "@/lib/schemas/_shared"

export const feedbackCategory = z.enum(["idea", "bug", "praise", "other"])
export type FeedbackCategory = z.infer<typeof feedbackCategory>

export const feedbackFormSchema = z.object({
  message: z.string().trim().min(3, "Tell us a bit more").max(2000),
  category: feedbackCategory.default("other"),
})
export type FeedbackFormValues = z.infer<typeof feedbackFormSchema>

export const feedbackSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  userEmail: z.string(),
  userName: z.string(),
  message: z.string(),
  category: feedbackCategory,
  createdAt: isoTimestamp,
})
export type Feedback = z.infer<typeof feedbackSchema>

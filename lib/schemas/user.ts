import { z } from "zod"
import { audit, userRole } from "./_shared"

export const userSchema = audit.extend({
  id: z.string(),
  organizationId: z.string(),
  email: z.string().email(),
  name: z.string().min(1),
  role: userRole.default("contributor"),
  active: z.boolean().default(true),
  googleUid: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  defaultCategories: z.array(z.string()).default([]),
  googleId: z.string().optional(),
  preferences: z
    .object({
      onboarded: z.boolean().optional(),
    })
    .partial()
    .optional(),
})
export type User = z.infer<typeof userSchema>

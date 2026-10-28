import { z } from "zod"

/* Plan intents a visitor can carry from /pricing into the invite flow.
 * "trial" = the 30-day Agency trial; the rest are billable plan ids. */
export const PLAN_CHOICES = ["trial", "studio_v1", "agency_v1"] as const
export type PlanChoice = (typeof PLAN_CHOICES)[number]

export const signupRequestFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().email("Enter a valid email"),
  company: z.string().max(120).optional(),
  useCase: z.string().max(500).optional(),
  plan: z.enum(PLAN_CHOICES).optional(),
  acceptedTerms: z
    .boolean()
    .refine((v) => v === true, "Please accept the terms and privacy policy to continue"),
})

export type SignupRequestFormInput = z.infer<typeof signupRequestFormSchema>

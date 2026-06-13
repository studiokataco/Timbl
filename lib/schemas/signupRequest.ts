import { z } from "zod"

export const signupRequestFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  email: z.string().email("Enter a valid email"),
  company: z.string().max(120).optional(),
  useCase: z.string().max(500).optional(),
})

export type SignupRequestFormInput = z.infer<typeof signupRequestFormSchema>

import { z } from "zod"

export const authIntentSchema = z.enum(["signup", "signin"])

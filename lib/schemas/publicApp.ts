import { z } from "zod"
import { audit } from "./_shared"
import { publicScopeSchema } from "@/lib/auth/public-scopes"

export const rateTierSchema = z.enum(["free", "agency", "operator"])
export type RateTier = z.infer<typeof rateTierSchema>

export const publicAppSchema = audit.extend({
  id: z.string(),
  organizationId: z.string(),
  name: z.string().min(1).max(100),

  keyPrefix: z.string(),
  keyHash: z.string(),
  keyCiphertext: z.string(),

  scopes: z.array(publicScopeSchema),
  rateTier: rateTierSchema.default("free"),

  createdBy: z.string(),
  revokedAt: z.string().optional(),
})
export type PublicApp = z.infer<typeof publicAppSchema>

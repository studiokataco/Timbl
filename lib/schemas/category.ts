import { z } from "zod"
import { audit, postType } from "./_shared"

export const categorySchema = audit.extend({
  id: z.string(),
  organizationId: z.string(),
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  defaultLeadId: z.string().optional(),
  /** Hex token. Sourced from DESIGN.md signature palette where possible. */
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  /** lucide-react icon name (e.g. "shopping-bag"). */
  icon: z.string().optional(),
  description: z.string().optional(),
  defaultPostType: postType.default("grid"),
  defaultHashtags: z.array(z.string()).default([]),
  defaultCtaId: z.string().optional(),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().nonnegative().default(0),
})
export type Category = z.infer<typeof categorySchema>

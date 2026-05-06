import { z } from "zod"
import { audit } from "./_shared"

export const kanbanColumnSchema = audit.extend({
  id: z.string(),
  organizationId: z.string(),
  label: z.string().min(1),
  sortOrder: z.number().int().nonnegative(),
  /** Hex token used for the colour edge + swatch. */
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  /** Marks the 9 default columns seeded from the legacy PostStatus enum. */
  isSystemDefault: z.boolean().default(false),
})
export type KanbanColumn = z.infer<typeof kanbanColumnSchema>

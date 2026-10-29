import { z } from "zod"
import { audit } from "./_shared"

const kanbanColumnGroup = z.enum(["active", "done", "closed"])

export const kanbanColumnSchema = audit.extend({
  id: z.string(),
  organizationId: z.string(),
  label: z.string().min(1),
  sortOrder: z.number().int().nonnegative(),
  /** Hex token used for the colour edge + swatch. */
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  /** Marks the 9 default columns seeded from the legacy PostStatus enum. */
  isSystemDefault: z.boolean().default(false),
  group: kanbanColumnGroup.optional(),
})
export type KanbanColumn = z.infer<typeof kanbanColumnSchema>
export type KanbanColumnGroup = z.infer<typeof kanbanColumnGroup>

/* Orgs bootstrapped before columns carried a group have none stored; the
 * system default ids still map to their intended lifecycle stage. */
const SYSTEM_COLUMN_GROUPS: Record<string, KanbanColumnGroup> = {
  scheduled: "done",
  posted: "done",
  missed: "closed",
  archived: "closed",
}

export function columnGroup(c: Pick<KanbanColumn, "id" | "group">): KanbanColumnGroup {
  return c.group ?? SYSTEM_COLUMN_GROUPS[c.id] ?? "active"
}

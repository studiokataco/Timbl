import type { PostStatus } from "@/lib/schemas"

/*
 * With custom kanban columns, status is a free string. The composer's status
 * select shows every column id (including the current one) so users can move
 * a post anywhere - the rigid enum-era state machine is gone.
 */
export function getNextStatuses(
  current: PostStatus,
  columnIds: readonly string[],
): PostStatus[] {
  const set = new Set<PostStatus>([current, ...columnIds])
  return Array.from(set)
}

import type { PostStatus } from "@/lib/schemas"

/*
 * Status transition map. Composer renders only valid next states (current +
 * up to 3 forward) to keep the dropdown short and meaningful.
 */
const TRANSITIONS: Record<PostStatus, PostStatus[]> = {
  idea: ["brief", "researching", "archived"],
  brief: ["researching", "designing", "archived"],
  researching: ["designing", "review", "archived"],
  designing: ["review", "scheduled", "archived"],
  review: ["scheduled", "designing", "archived"],
  scheduled: ["posted", "missed", "designing"],
  posted: ["archived"],
  missed: ["scheduled", "archived"],
  archived: ["idea"],
}

export function getNextStatuses(current: PostStatus): PostStatus[] {
  return [current, ...TRANSITIONS[current]]
}

import type { CalendarFilter } from "@/components/agentic/types"
import type { Post } from "@/lib/schemas"

export function matchesCalendarFilter(post: Post, filter: CalendarFilter): boolean {
  if (filter === "all") return true
  if (filter === "scheduled") return post.status === "scheduled"
  if (filter === "sent") return post.status === "posted"
  if (filter === "needs-approval") {
    return (
      post.status === "review" ||
      post.status === "needs_approval" ||
      post.agentMeta?.reviewState === "pending"
    )
  }
  if (post.status === "scheduled" || post.status === "posted" || post.status === "review") {
    return false
  }
  if (post.agentMeta?.reviewState === "pending") return false
  return post.status !== "archived"
}

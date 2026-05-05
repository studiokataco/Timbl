"use client"

import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { cn } from "@/lib/utils"
import type { WithId } from "@/lib/firebase/serialize"
import type { Category, Post, PostStatus, User } from "@/lib/schemas"
import { KanbanCard } from "./card"

const STATUS_LABELS: Record<PostStatus, string> = {
  idea: "Idea",
  brief: "Brief",
  researching: "Researching",
  designing: "Designing",
  review: "Review",
  scheduled: "Scheduled",
  posted: "Posted",
  missed: "Missed",
  archived: "Archived",
}

type Props = {
  status: PostStatus
  posts: WithId<Post>[]
  categoryById: Map<string, WithId<Category>>
  userById: Map<string, WithId<User>>
  onCardClick: (post: WithId<Post>) => void
}

export function KanbanColumn({
  status,
  posts,
  categoryById,
  userById,
  onCardClick,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const subdued = status === "posted" || status === "missed" || status === "archived"

  return (
    <div className="flex flex-col min-w-[220px] w-[220px] shrink-0">
      <div className="flex items-center justify-between mb-2 px-0.5">
        <h3
          className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            subdued ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {STATUS_LABELS[status]}
        </h3>
        <span className="text-xs text-muted-foreground">{posts.length}</span>
      </div>
      <SortableContext
        items={posts.map((p) => p.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className={cn(
            "flex flex-col gap-2 flex-1 rounded-lg p-2 min-h-[120px] transition-colors",
            isOver
              ? "bg-secondary/80 ring-1 ring-border"
              : subdued
                ? "bg-secondary/20"
                : "bg-secondary/40",
          )}
        >
          {posts.map((post) => (
            <KanbanCard
              key={post.id}
              post={post}
              category={categoryById.get(post.categoryId ?? "")}
              assignee={userById.get(post.assigneeId ?? "")}
              onClick={() => onCardClick(post)}
            />
          ))}
          {posts.length === 0 && (
            <p className="text-xs text-muted-foreground text-center mt-4 select-none">
              Drop here
            </p>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

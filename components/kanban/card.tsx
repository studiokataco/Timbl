"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { format, parseISO } from "date-fns"
import type { WithId } from "@/lib/firebase/serialize"
import type { Category, Post, User } from "@/lib/schemas"
import { cn } from "@/lib/utils"

type Props = {
  post: WithId<Post>
  category: WithId<Category> | undefined
  assignee: WithId<User> | undefined
  onClick: () => void
  isDragging?: boolean
}

export function KanbanCard({ post, category, assignee, onClick, isDragging }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: post.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "bg-background border border-border rounded-md p-2.5 cursor-grab active:cursor-grabbing",
        "hover:shadow-sm transition-shadow select-none",
        isDragging && "opacity-40",
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {format(parseISO(post.scheduledDate), "d MMM")}
        </span>
        {category && (
          <span
            className="inline-block size-2 rounded-full mt-0.5 shrink-0"
            style={{ backgroundColor: category.color }}
            aria-hidden
          />
        )}
      </div>
      <p className="text-sm leading-snug line-clamp-2 mb-2">
        {post.brief ?? <span className="italic text-muted-foreground">No brief</span>}
      </p>
      <div className="flex items-center justify-between gap-1">
        {category && (
          <span className="text-xs text-muted-foreground truncate">{category.name}</span>
        )}
        {assignee && (
          <span
            className="inline-flex items-center justify-center size-5 rounded-full bg-secondary text-xs font-medium shrink-0"
            title={assignee.name}
          >
            {assignee.name[0]?.toUpperCase()}
          </span>
        )}
      </div>
    </div>
  )
}

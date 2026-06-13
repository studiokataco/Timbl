"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { format, parseISO } from "date-fns"
import { cn } from "@/lib/utils"
import type { WithId } from "@/lib/firebase/serialize"
import type { IdeationItem } from "@/lib/schemas/ideationItem"
import type { Post } from "@/lib/schemas/post"

type IdeaCardProps = {
  item: WithId<IdeationItem>
  isDragging?: boolean
}

type PostCardProps = {
  post: WithId<Post>
  isDragging?: boolean
}

export function IdeaCard({ item, isDragging }: IdeaCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: `idea-${item.id}`,
  })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const pct = Math.round(item.confidence * 100)

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "bg-[#f5f5f5] border border-[#e5e7eb] rounded-xl p-3 cursor-grab active:cursor-grabbing select-none",
        "hover:shadow-sm transition-shadow",
        isDragging && "opacity-40",
      )}
    >
      <p className="text-sm font-medium text-[#111111] leading-snug line-clamp-2 mb-2">
        {item.title}
      </p>
      {item.suggestedDate && (
        <p className="text-xs text-[#6b7280] mb-2">
          {format(parseISO(item.suggestedDate), "d MMM yyyy")}
        </p>
      )}
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6b7280]">
          <span
            className="size-1.5 rounded-full"
            style={{ backgroundColor: pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#ef4444" }}
          />
          {pct}% confidence
        </span>
        <span className="text-[11px] rounded-full px-2 py-0.5 bg-white border border-[#e5e7eb] text-[#6b7280]">
          {item.status}
        </span>
      </div>
    </div>
  )
}

export function PostCard({ post, isDragging }: PostCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: `post-${post.id}`,
  })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "bg-[#f5f5f5] border border-[#e5e7eb] rounded-xl p-3 cursor-grab active:cursor-grabbing select-none",
        "hover:shadow-sm transition-shadow",
        isDragging && "opacity-40",
      )}
    >
      <p className="text-sm font-medium text-[#111111] leading-snug line-clamp-2 mb-2">
        {post.brief ?? <span className="italic text-[#6b7280]">No brief</span>}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#6b7280]">
          {format(parseISO(post.scheduledDate), "d MMM yyyy")}
        </span>
        <span
          className={cn(
            "text-[11px] rounded-full px-2 py-0.5 border font-medium",
            post.status === "scheduled"
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : "bg-white border-[#e5e7eb] text-[#6b7280]",
          )}
        >
          {post.status}
        </span>
      </div>
    </div>
  )
}

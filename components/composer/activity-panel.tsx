"use client"

import { useState, useTransition } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNow, parseISO } from "date-fns"
import { toast } from "sonner"

import { fetchPostActivity } from "@/lib/actions/post-activity"
import { addComment } from "@/lib/actions/post-comments"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { PostActivity } from "@/lib/schemas/postActivity"

interface ActivityPanelProps {
  postId: string
  orgId?: string
}

type FilterType = "all" | "comments" | "status" | "dates"

const FILTERS: { label: string; value: FilterType }[] = [
  { label: "All", value: "all" },
  { label: "Comments", value: "comments" },
  { label: "Status", value: "status" },
  { label: "Dates", value: "dates" },
]

function activityText(entry: PostActivity): string {
  const p = entry.payload
  switch (entry.type) {
    case "created":
      return "Created this post"
    case "status":
      return `Status: ${p.from} -> ${p.to}`
    case "dates":
      return `Set date to ${p.date}`
    case "priority":
      return `Priority set to ${p.priority}`
    case "assignee":
      return `Assigned to ${p.name}`
    case "category":
      return `Category: ${p.name}`
    case "hashtags":
      return `Added tag #${p.tag}`
    case "follow":
      return p.action === "follow" ? "Started following" : "Unfollowed"
    case "edit":
      return "Updated post"
    default:
      return entry.type
  }
}

function initials(actorId: string): string {
  return actorId.slice(0, 2).toUpperCase()
}

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true })
  } catch {
    return ""
  }
}

export function ActivityPanel({ postId }: ActivityPanelProps) {
  const queryClient = useQueryClient()
  const [filterType, setFilterType] = useState<FilterType>("all")
  const [comment, setComment] = useState("")
  const [isPending, startTransition] = useTransition()

  const { data: activities, isLoading } = useQuery<PostActivity[]>({
    queryKey: ["post-activity", postId],
    queryFn: () => fetchPostActivity(postId),
    staleTime: 30_000,
  })

  function handleAddComment() {
    if (!comment.trim()) return
    const body = comment.trim()
    startTransition(async () => {
      const result = await addComment({ postId, body })
      if (!result.ok) {
        toast.error(result.error ?? "Failed to add comment")
        return
      }
      setComment("")
      queryClient.invalidateQueries({ queryKey: ["post-activity", postId] })
    })
  }

  const filtered = (activities ?? []).filter((e) => {
    if (filterType === "all") return true
    if (filterType === "comments") return e.type === "comment"
    if (filterType === "status") return e.type === "status"
    if (filterType === "dates") return e.type === "dates"
    return true
  })

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b px-4 py-3">
        <span className="text-sm font-medium">Activity</span>
        <div className="mt-2 flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilterType(f.value)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                filterType === f.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-8 w-full animate-pulse rounded bg-muted" />
            ))}
          </>
        ) : filtered.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          </div>
        ) : (
          filtered.map((entry) =>
            entry.type === "comment" ? (
              <div key={entry.id} className="flex items-start gap-2">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                  {initials(entry.actorId)}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                    {entry.payload.body as string}
                  </div>
                  <span className="text-right text-[11px] text-muted-foreground">
                    {relativeTime(entry.createdAt)}
                  </span>
                </div>
              </div>
            ) : (
              <div key={entry.id} className="flex items-baseline justify-between gap-2 py-0.5">
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <span aria-hidden className="shrink-0 text-[10px] text-muted-foreground/50">•</span>
                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                    {activityText(entry)}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground/50">
                  {relativeTime(entry.createdAt)}
                </span>
              </div>
            )
          )
        )}
      </div>

      {/* Comment composer */}
      <div className="shrink-0 border-t px-4 py-3">
        <textarea
          className="w-full resize-none rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          placeholder="Add a comment..."
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddComment()
          }}
        />
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            disabled={!comment.trim() || isPending}
            onClick={handleAddComment}
          >
            Add comment
          </Button>
        </div>
      </div>
    </div>
  )
}

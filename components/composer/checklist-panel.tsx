"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  fetchChecklist,
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
} from "@/lib/actions/post-checklist"
import type { ChecklistItem } from "@/lib/schemas/checklistItem"

interface ChecklistPanelProps {
  postId: string
}

export function ChecklistPanel({ postId }: ChecklistPanelProps) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState("")
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: items = [], isLoading } = useQuery<ChecklistItem[]>({
    queryKey: ["checklist", postId],
    queryFn: () => fetchChecklist(postId),
    staleTime: 30_000,
  })

  const done = items.filter((i) => i.done).length
  const total = items.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  function handleAdd() {
    const label = draft.trim()
    if (!label) return
    startTransition(async () => {
      const res = await addChecklistItem({ postId, label })
      if (!res.ok) { toast.error(res.error ?? "Could not add item"); return }
      setDraft("")
      queryClient.invalidateQueries({ queryKey: ["checklist", postId] })
    })
  }

  function handleToggle(item: ChecklistItem) {
    startTransition(async () => {
      await toggleChecklistItem({ postId, itemId: item.id, done: !item.done })
      queryClient.invalidateQueries({ queryKey: ["checklist", postId] })
    })
  }

  function handleDelete(itemId: string) {
    startTransition(async () => {
      await deleteChecklistItem({ postId, itemId })
      queryClient.invalidateQueries({ queryKey: ["checklist", postId] })
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Progress */}
      {total > 0 && (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {done}/{total}
          </span>
        </div>
      )}

      {/* Items */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/40">
              <button
                type="button"
                onClick={() => handleToggle(item)}
                disabled={isPending}
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                  item.done
                    ? "border-foreground bg-foreground text-background"
                    : "border-muted-foreground/40 hover:border-foreground",
                )}
                aria-label={item.done ? "Mark incomplete" : "Mark complete"}
              >
                {item.done && <Check className="size-2.5" aria-hidden />}
              </button>
              <span className={cn("flex-1 min-w-0 text-sm", item.done && "line-through text-muted-foreground")}>
                {item.label}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(item.id)}
                disabled={isPending}
                className="shrink-0 text-muted-foreground/40 opacity-0 transition-all hover:text-destructive group-hover:opacity-100 disabled:pointer-events-none"
                aria-label="Delete item"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add item */}
      <div className="flex items-center gap-1.5">
        <Plus className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); handleAdd() }
          }}
          placeholder="Add item..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40"
          disabled={isPending}
        />
        {draft.trim() && (
          <button
            type="button"
            onClick={handleAdd}
            disabled={isPending}
            className="shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            Add
          </button>
        )}
      </div>
    </div>
  )
}

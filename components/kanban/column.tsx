"use client"

import { useMemo, useState } from "react"
import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { MoreHorizontal, Palette, Pencil, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { GenerateDraftsDialog } from "@/components/agents/generate-drafts-dialog"
import { cn } from "@/lib/utils"
import type { WithId } from "@/lib/firebase/serialize"
import type { Category, KanbanColumn, Post, PostStatus, User } from "@/lib/schemas"
import { KanbanCard } from "./card"
import { ColumnDeleteDialog } from "./column-delete-dialog"
import { ColumnEditDialog } from "./column-edit-dialog"

type Props = {
  column: WithId<KanbanColumn>
  allColumns: WithId<KanbanColumn>[]
  posts: WithId<Post>[]
  categoryById: Map<string, WithId<Category>>
  userById: Map<string, WithId<User>>
  onCardClick: (post: WithId<Post>) => void
  onCardStatusChange?: (post: WithId<Post>, next: PostStatus) => void
  selectedIds?: ReadonlySet<string>
  selectionActive?: boolean
  onToggleSelect?: (post: WithId<Post>) => void
}

export function KanbanColumn({
  column,
  allColumns,
  posts,
  categoryById,
  userById,
  onCardClick,
  onCardStatusChange,
  selectedIds,
  selectionActive,
  onToggleSelect,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column" },
  })
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)

  const columnIds = useMemo(() => allColumns.map((c) => c.id), [allColumns])

  return (
    <div className="flex flex-col flex-1 min-w-[200px] min-h-full">
      <div className="flex items-center gap-2 mb-2 px-1">
        <span
          aria-hidden
          className="size-2 rounded-full shrink-0"
          style={{ backgroundColor: column.color }}
        />
        <h3 className="text-sm font-medium truncate flex-1">{column.label}</h3>
        <Badge
          variant="secondary"
          className="font-normal text-[11px] px-1.5 py-0 tabular-nums"
        >
          {posts.length}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={`${column.label} column actions`}
              />
            }
          >
            <MoreHorizontal aria-hidden className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setGenerateOpen(true)}>
              <Sparkles aria-hidden className="size-3.5" />
              Generate drafts
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              <Pencil aria-hidden className="size-3.5" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              <Palette aria-hidden className="size-3.5" />
              Recolor
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => setDeleteOpen(true)}
              disabled={allColumns.length <= 1}
            >
              <Trash2 aria-hidden className="size-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <GenerateDraftsDialog
          open={generateOpen}
          onOpenChange={setGenerateOpen}
          columnId={column.id}
          columnLabel={column.label}
        />
      </div>
      <SortableContext
        items={posts.map((p) => p.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className={cn(
            "flex flex-col gap-2 flex-1 rounded-lg p-2 transition-colors",
            isOver
              ? "bg-secondary/80 ring-1 ring-border"
              : "bg-secondary/40",
          )}
          style={{
            borderLeft: `2px solid ${column.color}`,
          }}
        >
          {posts.map((post) => (
            <KanbanCard
              key={post.id}
              post={post}
              category={categoryById.get(post.categoryId ?? "")}
              assignee={userById.get(post.assigneeId ?? "")}
              columnIds={columnIds}
              onClick={() => onCardClick(post)}
              onStatusChange={
                onCardStatusChange
                  ? (next) => onCardStatusChange(post, next)
                  : undefined
              }
              selected={selectedIds?.has(post.id)}
              selectionActive={selectionActive}
              onToggleSelect={
                onToggleSelect ? () => onToggleSelect(post) : undefined
              }
            />
          ))}
          {posts.length === 0 && (
            <p className="text-xs text-muted-foreground text-center mt-4 select-none">
              Drop here
            </p>
          )}
        </div>
      </SortableContext>

      <ColumnEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        column={column}
      />
      <ColumnDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        column={column}
        allColumns={allColumns}
        postCount={posts.length}
      />
    </div>
  )
}

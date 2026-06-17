"use client"

import { memo, useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useDroppable } from "@dnd-kit/core"
import { MoreHorizontal, Palette, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { isProtectedStatusId } from "@/lib/schemas"
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
  dragEnabled?: boolean
  fullWidth?: boolean
}

const laneClass = (isOver: boolean) =>
  cn(
    "flex flex-col gap-2 flex-1 rounded-lg p-2 transition-colors",
    isOver ? "bg-secondary/80 ring-1 ring-border" : "bg-secondary/40",
  )

function Lane({
  droppableId,
  color,
  children,
}: {
  droppableId?: string
  color: string
  children: ReactNode
}) {
  if (droppableId) {
    return (
      <DroppableLane droppableId={droppableId} color={color}>
        {children}
      </DroppableLane>
    )
  }
  return (
    <div className={laneClass(false)} style={{ borderLeft: `2px solid ${color}` }}>
      {children}
    </div>
  )
}

function DroppableLane({
  droppableId,
  color,
  children,
}: {
  droppableId: string
  color: string
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { type: "column" },
  })
  return (
    <div
      ref={setNodeRef}
      className={laneClass(isOver)}
      style={{ borderLeft: `2px solid ${color}` }}
    >
      {children}
    </div>
  )
}

export const KanbanColumnComponent = memo(function KanbanColumnComponent({
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
  dragEnabled = true,
  fullWidth = false,
}: Props) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const columnIds = useMemo(() => allColumns.map((c) => c.id), [allColumns])

  return (
    <div
      className={cn(
        "flex min-h-full flex-col flex-1",
        fullWidth ? "w-full min-w-0" : "min-w-[200px]",
      )}
    >
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
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil aria-hidden className="size-3.5" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Palette aria-hidden className="size-3.5" />
              Recolor
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setDeleteOpen(true)}
              disabled={allColumns.length <= 1 || isProtectedStatusId(column.id)}
            >
              <Trash2 aria-hidden className="size-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Lane droppableId={dragEnabled ? column.id : undefined} color={column.color}>
        {posts.map((post) => (
          <KanbanCard
            key={post.id}
            post={post}
            category={categoryById.get(post.categoryId ?? "")}
            assignee={userById.get(post.assigneeId ?? "")}
            columnIds={columnIds}
            statusColor={column.color}
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
            dragEnabled={dragEnabled}
          />
        ))}
        {posts.length === 0 && (
          <p className="text-xs text-muted-foreground text-center mt-4 select-none">
            Drop here
          </p>
        )}
      </Lane>

      <ColumnEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        column={column}
        onDone={() => router.refresh()}
      />
      <ColumnDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        column={column}
        allColumns={allColumns}
        postCount={posts.length}
        onDone={() => router.refresh()}
      />
    </div>
  )
})

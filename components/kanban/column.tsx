"use client"

import { memo, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useDndContext, useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { ChevronsLeft, MoreHorizontal, Palette, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { columnGroup, isProtectedStatusId } from "@/lib/schemas"
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
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  filtered?: boolean
}

function useLaneDrop(id: string, enabled: boolean) {
  const { setNodeRef, isOver } = useDroppable({
    id: enabled ? id : `inactive-lane-${id}`,
    disabled: !enabled,
    data: { type: "column" },
  })
  const { active } = useDndContext()
  return { setNodeRef, isOver: enabled && isOver, dragging: enabled && !!active }
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
  collapsed = false,
  onCollapsedChange,
  filtered = false,
}: Props) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const { setNodeRef, isOver, dragging } = useLaneDrop(column.id, dragEnabled)

  const columnIds = useMemo(() => allColumns.map((c) => c.id), [allColumns])
  const columnLabels = useMemo(
    () => new Map(allColumns.map((c) => [c.id, c.label])),
    [allColumns],
  )
  const openWork = columnGroup(column) === "active"

  const dialogs = (
    <>
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
    </>
  )

  if (collapsed && !fullWidth) {
    return (
      <div data-column-id={column.id} className="flex h-full shrink-0 flex-col">
        <button
          ref={setNodeRef}
          type="button"
          onClick={() => onCollapsedChange?.(false)}
          aria-label={`Expand ${column.label}, ${posts.length} posts`}
          title={`Expand ${column.label}`}
          className={cn(
            "flex h-full w-11 flex-col items-center gap-3 rounded-xl py-3 text-muted-foreground outline-none",
            "transition-[background-color,box-shadow,color] duration-150 ease-out",
            "bg-secondary/40 hover:bg-secondary/80 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
            dragging && "ring-1 ring-inset ring-border",
            isOver && "bg-secondary text-foreground ring-2 ring-foreground/25",
          )}
        >
          <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: column.color }} />
          <span className="text-xs font-medium tabular-nums">{posts.length}</span>
          <span className="truncate text-[13px] font-medium [writing-mode:vertical-rl]">
            {column.label}
          </span>
        </button>
        {dialogs}
      </div>
    )
  }

  return (
    <div
      data-column-id={column.id}
      className={cn(
        "group/col flex flex-col animate-in fade-in-0 motion-reduce:animate-none",
        fullWidth ? "w-full min-w-0" : "h-full min-h-0 w-[284px] shrink-0",
      )}
    >
      <div className="mb-2 flex h-8 items-center gap-2 pl-2 pr-0.5">
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: column.color }}
        />
        <h3 className="min-w-0 truncate text-sm font-semibold text-foreground">{column.label}</h3>
        <span className="text-xs tabular-nums text-muted-foreground">{posts.length}</span>
        <span className="flex-1" />
        {!fullWidth && onCollapsedChange ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground opacity-0 transition-opacity group-hover/col:opacity-100 focus-visible:opacity-100"
            onClick={() => onCollapsedChange(true)}
            aria-label={`Collapse ${column.label}`}
            title="Collapse"
          >
            <ChevronsLeft aria-hidden className="size-4" />
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground"
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

      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-col gap-1.5 rounded-xl p-1.5 transition-[background-color,box-shadow] duration-150 ease-out",
          fullWidth ? "min-h-40" : "min-h-0 flex-1 overflow-y-auto scrollbar-subtle",
          "bg-secondary/40",
          dragging && "ring-1 ring-inset ring-border",
          isOver && "bg-secondary/90 ring-2 ring-foreground/20",
        )}
      >
        <SortableContext
          id={`sortable-${column.id}`}
          items={dragEnabled ? posts.map((p) => p.id) : []}
          strategy={verticalListSortingStrategy}
        >
        {posts.map((post) => (
          <KanbanCard
            key={post.id}
            post={post}
            category={categoryById.get(post.categoryId ?? "")}
            assignee={userById.get(post.assigneeId ?? "")}
            columnIds={columnIds}
            columnLabels={columnLabels}
            openWork={openWork}
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
        </SortableContext>
        {dragging ? (
          <div
            aria-hidden
            className={cn(
              "flex h-14 shrink-0 items-center justify-center rounded-lg border border-dashed text-xs transition-colors duration-150",
              isOver
                ? "border-foreground/30 text-foreground"
                : "border-transparent text-transparent",
            )}
          >
            Move to {column.label}
          </div>
        ) : posts.length === 0 ? (
          <p className="select-none px-3 py-6 text-center text-xs leading-relaxed text-muted-foreground">
            {filtered ? "No matches here" : openWork ? "Nothing here yet. Drag a post in." : "Nothing here"}
          </p>
        ) : null}
      </div>
      {dialogs}
    </div>
  )
})

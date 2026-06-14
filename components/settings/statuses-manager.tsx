"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Lock, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ColumnEditDialog } from "@/components/kanban/column-edit-dialog"
import { ColumnDeleteDialog } from "@/components/kanban/column-delete-dialog"
import { reorderKanbanColumns } from "@/lib/actions/kanban-columns"
import { cn } from "@/lib/utils"
import { isProtectedStatusId } from "@/lib/schemas"
import type { WithId } from "@/lib/firebase/serialize"
import type { KanbanColumn } from "@/lib/schemas"

export function StatusesManager({
  columns,
  postCountByStatus,
}: {
  columns: WithId<KanbanColumn>[]
  postCountByStatus: Record<string, number>
}) {
  const router = useRouter()
  const [items, setItems] = useState(columns)
  const inflightRef = useRef(0)
  useEffect(() => {
    if (inflightRef.current === 0) setItems(columns)
  }, [columns])

  const [dialogState, setDialogState] = useState<
    | { mode: "closed" }
    | { mode: "create" }
    | { mode: "edit"; column: WithId<KanbanColumn> }
  >({ mode: "closed" })
  const [deleteTarget, setDeleteTarget] = useState<WithId<KanbanColumn> | null>(
    null,
  )
  const [pending, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const prev = items
    const next = arrayMove(items, oldIndex, newIndex)
    setItems(next)
    inflightRef.current++
    startTransition(async () => {
      const result = await reorderKanbanColumns({ ids: next.map((i) => i.id) })
      inflightRef.current--
      if (!result.ok) {
        setItems(prev)
        toast.error(result.error ?? "Could not reorder")
      } else {
        router.refresh()
      }
    })
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-end">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => setDialogState({ mode: "create" })}
        >
          <Plus className="size-4" />
          New status
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 border-b border-border px-3 py-2 text-xs text-muted-foreground">
          <div className="w-6" aria-hidden />
          <div>Status</div>
          <div className="hidden w-16 text-right sm:block">Posts</div>
          <div className="w-20 text-right">Actions</div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul>
              {items.map((col) => (
                <StatusRow
                  key={col.id}
                  column={col}
                  postCount={postCountByStatus[col.id] ?? 0}
                  canDelete={items.length > 1 && !isProtectedStatusId(col.id)}
                  onEdit={() => setDialogState({ mode: "edit", column: col })}
                  onDelete={() => setDeleteTarget(col)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>

        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No statuses yet. Create one to start the workflow.
          </p>
        ) : null}
      </div>

      <ColumnEditDialog
        open={dialogState.mode !== "closed"}
        onOpenChange={(v) => {
          if (!v) setDialogState({ mode: "closed" })
        }}
        mode={dialogState.mode === "edit" ? "edit" : "create"}
        column={dialogState.mode === "edit" ? dialogState.column : undefined}
        onDone={() => router.refresh()}
      />

      <ColumnDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null)
        }}
        column={deleteTarget}
        allColumns={items}
        postCount={deleteTarget ? postCountByStatus[deleteTarget.id] ?? 0 : 0}
        onDone={() => router.refresh()}
      />
    </>
  )
}

function StatusRow({
  column,
  postCount,
  canDelete,
  onEdit,
  onDelete,
}: {
  column: WithId<KanbanColumn>
  postCount: number
  canDelete: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: column.id })
  const protectedStatus = isProtectedStatusId(column.id)

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 border-b border-border bg-background px-3 py-2 last:border-b-0",
        isDragging && "opacity-60 shadow-sm",
      )}
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden
          className="size-4 shrink-0 rounded-full border border-border/60"
          style={{ backgroundColor: column.color }}
        />
        <span className="truncate text-sm font-medium">{column.label}</span>
        {protectedStatus ? (
          <Badge variant="outline" className="gap-1 text-xs">
            <Lock className="size-3" />
            Required
          </Badge>
        ) : null}
      </div>

      <div className="hidden w-16 text-right text-xs tabular-nums text-muted-foreground sm:block">
        {postCount}
      </div>

      <div className="flex w-20 justify-end gap-1">
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Edit ${column.label}`}
          onClick={onEdit}
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Delete ${column.label}`}
          disabled={!canDelete}
          title={
            protectedStatus
              ? "Required by the publishing workflow"
              : undefined
          }
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  )
}

"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CategoryDialog } from "@/components/settings/category-dialog"
import { UpgradePromptFor } from "@/components/shared/upgrade-gate"
import { usePlanFeatures } from "@/lib/plans/client"
import {
  deleteCategory,
  reorderCategories,
} from "@/lib/actions/categories"
import { cn } from "@/lib/utils"
import type { WithId } from "@/lib/firebase/serialize"
import type { Category } from "@/lib/schemas"

/*
 * Settings/categories surface. Owns:
 *   - Reorder via @dnd-kit (single drop, posts the full ordered ids list
 *     so partial reorders can't drift)
 *   - Inline status (system badge, post-type label, color swatch)
 *   - Edit (opens CategoryDialog in edit mode)
 *   - Delete (opens reassign dialog when posts still reference it)
 *
 * The optimistic ordering lives in local state — server reorder is fire
 * and forget; on failure we toast and refresh to re-hydrate from the
 * server's truth.
 */

export function CategoriesManager({
  categories,
}: {
  categories: WithId<Category>[]
}) {
  const router = useRouter()
  const plan = usePlanFeatures()
  const [items, setItems] = useState(categories)
  /* Keep local state in sync with server prop after router.refresh() —
   * without this, a successful delete/create/edit roundtrips back but
   * the optimistic UI never reconciles with truth. We only adopt the
   * server snapshot when no mutation is in-flight, to avoid a flicker
   * of the pre-mutation state. */
  const inflightRef = useRef(0)
  useEffect(() => {
    if (inflightRef.current === 0) setItems(categories)
  }, [categories])
  const [dialogState, setDialogState] = useState<
    | { mode: "closed" }
    | { mode: "create" }
    | { mode: "edit"; category: WithId<Category> }
  >({ mode: "closed" })
  const [deleteState, setDeleteState] = useState<WithId<Category> | null>(null)
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
      const result = await reorderCategories({
        orderedIds: next.map((i) => i.id),
      })
      inflightRef.current--
      if (!result.ok) {
        setItems(prev)
        toast.error(result.error ?? "Could not reorder")
      } else {
        router.refresh()
      }
    })
  }

  function onOptimisticUpsert(cat: WithId<Category>) {
    setItems((curr) => {
      const idx = curr.findIndex((c) => c.id === cat.id)
      if (idx === -1) return [...curr, cat]
      const next = curr.slice()
      next[idx] = cat
      return next
    })
  }

  function onOptimisticDelete(id: string) {
    setItems((curr) => curr.filter((c) => c.id !== id))
  }

  const canCreate = plan.features.customCategories

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <UpgradePromptFor feature="customCategories">
          <p className="text-xs text-muted-foreground">
            Custom categories are on Studio and Agency plans.
          </p>
        </UpgradePromptFor>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            disabled={!canCreate || pending}
            onClick={() => setDialogState({ mode: "create" })}
          >
            <Plus className="size-4" />
            New category
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 border-b border-border px-3 py-2 text-xs text-muted-foreground">
          <div className="w-6" aria-hidden />
          <div>Category</div>
          <div className="hidden sm:block">Default type</div>
          <div className="hidden sm:block">Order</div>
          <div className="w-24 text-right">Actions</div>
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
              {items.map((cat, idx) => (
                <CategoryRow
                  key={cat.id}
                  index={idx}
                  category={cat}
                  onEdit={() => setDialogState({ mode: "edit", category: cat })}
                  onDelete={() => setDeleteState(cat)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>

        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No categories yet. Create one to start grouping posts.
          </p>
        ) : null}
      </div>

      <CategoryDialog
        open={dialogState.mode !== "closed"}
        onOpenChange={(v) => {
          if (!v) setDialogState({ mode: "closed" })
        }}
        mode={dialogState.mode === "edit" ? "edit" : "create"}
        category={dialogState.mode === "edit" ? dialogState.category : undefined}
        onOptimisticUpsert={onOptimisticUpsert}
        nextDisplayOrder={items.length}
      />

      <DeleteCategoryDialog
        target={deleteState}
        allCategories={items}
        onClose={() => setDeleteState(null)}
        onOptimisticDelete={onOptimisticDelete}
        inflightRef={inflightRef}
      />
    </>
  )
}

function CategoryRow({
  category,
  index,
  onEdit,
  onDelete,
}: {
  category: WithId<Category>
  index: number
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: category.id })

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 bg-background",
        isDragging && "opacity-60 shadow-sm",
      )}
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        className="text-muted-foreground hover:text-foreground touch-none cursor-grab"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden
          className="size-4 shrink-0 rounded-full border border-border/60"
          style={{ backgroundColor: category.color }}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{category.name}</span>
            {category.system ? (
              <Badge variant="outline" className="gap-1 text-xs">
                <Lock className="size-3" />
                System
              </Badge>
            ) : null}
          </div>
          {category.description ? (
            <p className="truncate text-xs text-muted-foreground">
              {category.description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="hidden text-xs text-muted-foreground sm:block">
        {category.defaultPostType}
      </div>
      <div className="hidden text-xs text-muted-foreground sm:block">
        {index + 1}
      </div>

      <div className="flex justify-end gap-1">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Edit category"
          onClick={onEdit}
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Delete category"
          disabled={category.system}
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  )
}

function DeleteCategoryDialog({
  target,
  allCategories,
  onClose,
  onOptimisticDelete,
  inflightRef,
}: {
  target: WithId<Category> | null
  allCategories: WithId<Category>[]
  onClose: () => void
  onOptimisticDelete: (id: string) => void
  inflightRef: { current: number }
}) {
  const router = useRouter()
  const [reassignTo, setReassignTo] = useState<string>("")

  const options = useMemo(
    () => allCategories.filter((c) => c.id !== target?.id),
    [allCategories, target?.id],
  )

  function handleClose(v: boolean) {
    if (!v) {
      onClose()
      setReassignTo("")
    }
  }

  function onConfirm() {
    if (!target) return
    const id = target.id
    const reassign = reassignTo || undefined
    /* Hide the row + close the dialog immediately. If the server
     * rejects (e.g. category has posts and no reassign target), we
     * roll back via router.refresh() and toast the error. */
    onOptimisticDelete(id)
    onClose()
    setReassignTo("")
    inflightRef.current++
    void deleteCategory({ id, reassignTo: reassign })
      .then((result) => {
        inflightRef.current--
        if (!result.ok) {
          if (
            result.error?.toLowerCase().includes("has posts") &&
            !reassign
          ) {
            toast.error("Pick a category to reassign posts to.", {
              description: "Reopening the category — try again with a target.",
            })
          } else {
            toast.error(result.error ?? "Could not delete")
          }
          router.refresh()
          return
        }
        toast.success("Category deleted")
        router.refresh()
      })
      .catch(() => {
        inflightRef.current--
        toast.error("Could not delete")
        router.refresh()
      })
  }

  return (
    <Dialog open={target !== null} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete category</DialogTitle>
          <DialogDescription>
            {target?.name
              ? `“${target.name}” will be removed.`
              : "This category will be removed."}{" "}
            If any posts still reference it, pick another category to
            reassign them to.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 py-2">
          <Label htmlFor="reassign">Reassign posts to</Label>
          <Select value={reassignTo} onValueChange={(v) => setReassignTo(v ?? "")}>
            <SelectTrigger id="reassign">
              <SelectValue placeholder="Optional — pick a target" />
            </SelectTrigger>
            <SelectContent>
              {options.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Leave empty if the category has no posts.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete category
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

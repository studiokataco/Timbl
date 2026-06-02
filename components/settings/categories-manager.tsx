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
import { GripVertical, Lock, Pencil, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Textarea } from "@/components/ui/textarea"
import { CategoryDialog } from "@/components/settings/category-dialog"
import {
  bulkCreateCategories,
  bulkDeleteCategories,
  deleteCategory,
  reorderCategories,
} from "@/lib/actions/categories"
import { cn } from "@/lib/utils"
import type { WithId } from "@/lib/firebase/serialize"
import type { Category } from "@/lib/schemas"

const PALETTE: { id: string; hex: string; label: string }[] = [
  { id: "orange", hex: "#fb923c", label: "Coral" },
  { id: "pink", hex: "#ec4899", label: "Pink" },
  { id: "violet", hex: "#8b5cf6", label: "Violet" },
  { id: "emerald", hex: "#34d399", label: "Emerald" },
  { id: "forest", hex: "#10b981", label: "Forest" },
  { id: "yellow", hex: "#f59e0b", label: "Yellow" },
  { id: "peach", hex: "#fbcfe8", label: "Peach" },
  { id: "cream", hex: "#fde68a", label: "Cream" },
]

/*
 * Settings/categories surface. Owns:
 *   - Reorder via @dnd-kit (single drop, posts the full ordered ids list)
 *   - Row-level checkboxes for bulk select
 *   - Bulk delete (with reassign) + bulk add (names textarea)
 *   - Inline edit (opens CategoryDialog)
 *   - Single delete (opens reassign dialog)
 */

export function CategoriesManager({
  categories,
}: {
  categories: WithId<Category>[]
}) {
  const router = useRouter()
  const [items, setItems] = useState(categories)
  const inflightRef = useRef(0)
  useEffect(() => {
    if (inflightRef.current === 0) setItems(categories)
  }, [categories])

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dialogState, setDialogState] = useState<
    | { mode: "closed" }
    | { mode: "create" }
    | { mode: "edit"; category: WithId<Category> }
  >({ mode: "closed" })
  const [deleteState, setDeleteState] = useState<WithId<Category> | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkAddOpen, setBulkAddOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const selectableIds = items.filter((c) => !c.system).map((c) => c.id)
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id))
  const someSelected = selected.size > 0

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(selectableIds))
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  function onOptimisticBulkDelete(ids: string[]) {
    setItems((curr) => curr.filter((c) => !ids.includes(c.id)))
    setSelected(new Set())
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setBulkAddOpen(true)}
          >
            <Plus className="size-4" />
            Bulk add
          </Button>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => setDialogState({ mode: "create" })}
          >
            <Plus className="size-4" />
            New category
          </Button>
      </div>

      {someSelected ? (
        <div className="mb-3 flex items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <Button
            size="sm"
            variant="destructive"
            className="h-7"
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="size-3.5" />
            Delete selected
          </Button>
          <button
            type="button"
            className="ml-auto text-muted-foreground hover:text-foreground"
            aria-label="Clear selection"
            onClick={() => setSelected(new Set())}
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card">
        <div className="grid grid-cols-[auto_auto_1fr_auto_auto] items-center gap-3 border-b border-border px-3 py-2 text-xs text-muted-foreground">
          <div className="w-6" aria-hidden />
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleSelectAll}
            aria-label="Select all non-system categories"
            className="opacity-60"
          />
          <div>Category</div>
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
                  selected={selected.has(cat.id)}
                  onToggleSelect={() => toggleSelect(cat.id)}
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

      <BulkDeleteDialog
        open={bulkDeleteOpen}
        selectedIds={Array.from(selected)}
        allCategories={items}
        onClose={() => setBulkDeleteOpen(false)}
        onOptimisticBulkDelete={onOptimisticBulkDelete}
        inflightRef={inflightRef}
      />

      <BulkAddDialog
        open={bulkAddOpen}
        onClose={() => setBulkAddOpen(false)}
        onOptimisticAdd={(cats) => setItems((curr) => [...curr, ...cats])}
        nextDisplayOrder={items.length}
      />
    </>
  )
}

function CategoryRow({
  category,
  index,
  selected,
  onToggleSelect,
  onEdit,
  onDelete,
}: {
  category: WithId<Category>
  index: number
  selected: boolean
  onToggleSelect: () => void
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
        "grid grid-cols-[auto_auto_1fr_auto_auto] items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 bg-background",
        isDragging && "opacity-60 shadow-sm",
        selected && "bg-muted/30",
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

      <Checkbox
        checked={selected}
        onCheckedChange={onToggleSelect}
        disabled={category.system}
        aria-label={`Select ${category.name}`}
      />

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
    onOptimisticDelete(id)
    onClose()
    setReassignTo("")
    inflightRef.current++
    void deleteCategory({ id, reassignTo: reassign })
      .then((result) => {
        inflightRef.current--
        if (!result.ok) {
          if (result.error?.toLowerCase().includes("has posts") && !reassign) {
            toast.error("Pick a category to reassign posts to.", {
              description: "Reopening the category - try again with a target.",
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
              ? `"${target.name}" will be removed.`
              : "This category will be removed."}{" "}
            If any posts still reference it, pick another category to reassign
            them to.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 py-2">
          <Label htmlFor="reassign">Reassign posts to</Label>
          <Select value={reassignTo} onValueChange={(v) => setReassignTo(v ?? "")}>
            <SelectTrigger id="reassign">
              <SelectValue placeholder="Optional - pick a target">
                {(v) => options.find((c) => c.id === v)?.name ?? "Optional - pick a target"}
              </SelectValue>
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

function BulkDeleteDialog({
  open,
  selectedIds,
  allCategories,
  onClose,
  onOptimisticBulkDelete,
  inflightRef,
}: {
  open: boolean
  selectedIds: string[]
  allCategories: WithId<Category>[]
  onClose: () => void
  onOptimisticBulkDelete: (ids: string[]) => void
  inflightRef: { current: number }
}) {
  const router = useRouter()
  const [reassignTo, setReassignTo] = useState<string>("")

  const options = useMemo(
    () => allCategories.filter((c) => !selectedIds.includes(c.id)),
    [allCategories, selectedIds],
  )

  const selectedNames = useMemo(
    () =>
      allCategories
        .filter((c) => selectedIds.includes(c.id))
        .map((c) => c.name),
    [allCategories, selectedIds],
  )

  function handleClose(v: boolean) {
    if (!v) {
      onClose()
      setReassignTo("")
    }
  }

  function onConfirm() {
    if (selectedIds.length === 0) return
    const reassign = reassignTo || undefined
    onOptimisticBulkDelete(selectedIds)
    onClose()
    setReassignTo("")
    inflightRef.current++
    void bulkDeleteCategories({ ids: selectedIds, reassignTo: reassign })
      .then((result) => {
        inflightRef.current--
        if (!result.ok) {
          toast.error(result.error ?? "Could not delete categories")
          router.refresh()
          return
        }
        toast.success(`${selectedIds.length} categories deleted`)
        router.refresh()
      })
      .catch(() => {
        inflightRef.current--
        toast.error("Could not delete categories")
        router.refresh()
      })
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {selectedIds.length} categories</DialogTitle>
          <DialogDescription>
            {selectedNames.length > 0
              ? selectedNames.join(", ")
              : `${selectedIds.length} categories`}{" "}
            will be permanently removed. If any posts reference these categories,
            pick one to reassign them to.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 py-2">
          <Label htmlFor="bulk-reassign">Reassign posts to</Label>
          <Select value={reassignTo} onValueChange={(v) => setReassignTo(v ?? "")}>
            <SelectTrigger id="bulk-reassign">
              <SelectValue placeholder="Optional - pick a target">
                {(v) => options.find((c) => c.id === v)?.name ?? "Optional - pick a target"}
              </SelectValue>
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
            Leave empty if none of the selected categories have posts.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete {selectedIds.length} categories
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BulkAddDialog({
  open,
  onClose,
  onOptimisticAdd,
  nextDisplayOrder,
}: {
  open: boolean
  onClose: () => void
  onOptimisticAdd: (cats: WithId<Category>[]) => void
  nextDisplayOrder: number
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [names, setNames] = useState("")
  const [color, setColor] = useState(PALETTE[0].hex)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const parsedNames = useMemo(
    () =>
      names
        .split("\n")
        .map((n) => n.trim())
        .filter(Boolean),
    [names],
  )

  function handleClose(v: boolean) {
    if (!v) {
      onClose()
      setNames("")
      setColor(PALETTE[0].hex)
    }
  }

  function onSubmit() {
    if (parsedNames.length === 0) return
    const items = parsedNames.map((name) => ({ name, color }))

    /* Optimistic add with temp ids. */
    const now = new Date().toISOString()
    onOptimisticAdd(
      items.map((item, i) => ({
        id: `temp-${now}-${i}`,
        organizationId: "",
        name: item.name,
        slug: item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60),
        color: item.color,
        defaultPostType: "grid",
        defaultHashtags: [],
        isActive: true,
        displayOrder: nextDisplayOrder + i,
        system: false,
        createdAt: now,
        updatedAt: now,
      } as WithId<Category>)),
    )
    onClose()
    setNames("")
    setColor(PALETTE[0].hex)

    setIsSubmitting(true)
    startTransition(async () => {
      const result = await bulkCreateCategories({ items })
      setIsSubmitting(false)
      if (!result.ok) {
        toast.error(result.error ?? "Could not create categories")
      } else {
        toast.success(`${items.length} categories created`)
      }
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk add categories</DialogTitle>
          <DialogDescription>
            Enter one category name per line. All will share the same color -
            edit individually after.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="bulk-names">Category names</Label>
            <Textarea
              id="bulk-names"
              autoFocus
              rows={6}
              placeholder={"Awareness Day\nFundraising Appeal\nVolunteer Spotlight"}
              value={names}
              onChange={(e) => setNames(e.target.value)}
            />
            {parsedNames.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {parsedNames.length} category{parsedNames.length !== 1 ? "s" : ""} to create
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label>Default color</Label>
            <div role="radiogroup" className="flex flex-wrap gap-2">
              {PALETTE.map((swatch) => {
                const selected = color.toLowerCase() === swatch.hex.toLowerCase()
                return (
                  <button
                    key={swatch.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={swatch.label}
                    onClick={() => setColor(swatch.hex)}
                    className={cn(
                      "size-8 rounded-full ring-offset-2 ring-offset-background transition",
                      selected
                        ? "ring-2 ring-foreground"
                        : "ring-1 ring-border hover:ring-foreground/40",
                    )}
                    style={{ backgroundColor: swatch.hex }}
                  />
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button
            disabled={parsedNames.length === 0 || isSubmitting}
            onClick={onSubmit}
          >
            Create {parsedNames.length > 0 ? parsedNames.length : ""} categories
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

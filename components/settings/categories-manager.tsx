"use client"

import { useEffect, useId, useMemo, useRef, useState, useTransition, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { arrayMove } from "@dnd-kit/sortable"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ListPlus, MoreHorizontal, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ListEmpty, ListGroup, ListPanel } from "@/components/shared/list-panel"
import { SettingsPage } from "@/components/settings/settings-page"
import { CategoryDialog, DialogField, DialogHead } from "@/components/settings/category-dialog"
import { CategoryColorSwatches, DEFAULT_CATEGORY_COLOR } from "@/components/settings/categories-color-swatches"
import { LockedNote, RowMenu, RowTag, SortableList, SortableRow } from "@/components/settings/categories-sortable"
import {
  bulkCreateCategories,
  bulkDeleteCategories,
  deleteCategory,
  reorderCategories,
} from "@/lib/actions/categories"
import { POST_TYPE_LABELS, labelOr } from "@/lib/labels/enums"
import type { WithId } from "@/lib/firebase/serialize"
import type { Category } from "@/lib/schemas"

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

function categoryDefaults(category: Category) {
  const type = labelOr(POST_TYPE_LABELS, category.defaultPostType || "grid").toLowerCase()
  const tags = category.defaultHashtags?.length ?? 0
  return [`Defaults to ${type} posts`, tags > 0 && plural(tags, "suggested hashtag", "suggested hashtags")]
    .filter(Boolean)
    .join(" · ")
}

export function CategoriesManager({
  categories,
  statuses,
}: {
  categories: WithId<Category>[]
  statuses?: ReactNode
}) {
  const router = useRouter()
  const reduced = useReducedMotion()
  const [items, setItems] = useState(categories)
  const inflightRef = useRef(0)
  useEffect(() => {
    if (inflightRef.current === 0) setItems(categories)
  }, [categories])

  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dialogState, setDialogState] = useState<
    { mode: "closed" } | { mode: "create" } | { mode: "edit"; category: WithId<Category> }
  >({ mode: "closed" })
  const [deleteState, setDeleteState] = useState<WithId<Category> | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkAddOpen, setBulkAddOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const selectableIds = items.filter((c) => !c.system).map((c) => c.id)
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id))

  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(selectableIds))
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function stopSelecting() {
    setSelecting(false)
    setSelected(new Set())
  }

  function move(from: number, to: number) {
    if (from === to || to < 0 || to >= items.length) return
    const prev = items
    const next = arrayMove(items, from, to)
    setItems(next)
    inflightRef.current++
    startTransition(async () => {
      const result = await reorderCategories({ orderedIds: next.map((i) => i.id) })
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
    stopSelecting()
  }

  const openCreate = () => setDialogState({ mode: "create" })
  const openBulkAdd = () => setBulkAddOpen(true)

  const actions = (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" className="hidden sm:inline-flex" disabled={pending} onClick={openBulkAdd}>
        <ListPlus aria-hidden />
        Bulk add
      </Button>
      <Button size="sm" className="h-9 px-3 sm:h-7 sm:px-2.5" disabled={pending} onClick={openCreate} aria-label="New category">
        <Plus aria-hidden />
        <span className="sm:hidden">New</span>
        <span className="hidden sm:inline">New category</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="icon" className="size-9 sm:hidden" aria-label="More category actions" />
          }
        >
          <MoreHorizontal aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem className="min-h-9 text-[13px]" disabled={pending} onClick={openBulkAdd}>
            <ListPlus aria-hidden />
            Bulk add
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  const groupLabel = selecting
    ? selected.size > 0
      ? `${selected.size} selected`
      : "Select categories to delete"
    : "All categories"

  const groupAction =
    selectableIds.length === 0 ? null : selecting ? (
      <div className="-my-1.5 flex items-center gap-1">
        <HeaderButton onClick={toggleSelectAll}>{allSelected ? "Clear" : "Select all"}</HeaderButton>
        <HeaderButton onClick={stopSelecting} strong>
          Done
        </HeaderButton>
      </div>
    ) : (
      <div className="-my-1.5">
        <HeaderButton onClick={() => setSelecting(true)}>Select</HeaderButton>
      </div>
    )

  return (
    <SettingsPage
      title="Categories"
      description="Colour-code posts on the calendar and filter by topic. Shared by every brand and campaign."
      action={actions}
    >
      <ListPanel>
        {items.length === 0 ? (
          <ListEmpty
            title="No categories yet"
            body="Categories colour posts on the calendar and let you filter by topic. Start with your main content pillars."
            action={
              <Button size="sm" className="h-9 sm:h-7" onClick={openCreate}>
                <Plus aria-hidden />
                New category
              </Button>
            }
          />
        ) : (
          <ListGroup label={groupLabel} count={selecting ? undefined : items.length} action={groupAction}>
            <SortableList
              id="categories-manager"
              ids={items.map((i) => i.id)}
              nameOf={(id) => items.find((i) => i.id === id)?.name ?? "Category"}
              onMove={move}
            >
              {items.map((cat, idx) => (
                <SortableRow
                  key={cat.id}
                  id={cat.id}
                  name={cat.name}
                  color={cat.color}
                  badge={cat.system ? <RowTag>Built in</RowTag> : null}
                  subtitle={<CategorySubtitle category={cat} />}
                  sortable={!selecting}
                  checked={selecting ? selected.has(cat.id) : undefined}
                  disabled={selecting && cat.system}
                  onOpen={
                    selecting ? () => toggleSelect(cat.id) : () => setDialogState({ mode: "edit", category: cat })
                  }
                  openLabel={selecting ? `Select ${cat.name}` : `Edit ${cat.name}`}
                  menu={
                    <RowMenu label={`More actions for ${cat.name}`} index={idx} count={items.length} onMove={move}>
                      <DropdownMenuSeparator />
                      {cat.system ? (
                        <LockedNote>Built-in categories can be renamed and recoloured, not deleted.</LockedNote>
                      ) : (
                        <DropdownMenuItem
                          variant="destructive"
                          className="min-h-9 text-[13px] sm:min-h-8"
                          onClick={() => setDeleteState(cat)}
                        >
                          <Trash2 aria-hidden />
                          Delete category
                        </DropdownMenuItem>
                      )}
                    </RowMenu>
                  }
                />
              ))}
            </SortableList>
          </ListGroup>
        )}
      </ListPanel>

      <AnimatePresence>
        {selecting && selected.size > 0 && (
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="sticky bottom-[var(--ask-ai-clearance)] z-20 mt-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 shadow-[0_2px_6px_rgb(0_0_0/0.08)]"
          >
            <span className="text-[13px] tabular-nums text-muted-foreground">
              {plural(selected.size, "category", "categories")} selected
            </span>
            <span className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" className="h-9 sm:h-7" onClick={stopSelecting}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-9 sm:h-7"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 aria-hidden />
                Delete
              </Button>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {statuses ? <div className="mt-12">{statuses}</div> : null}

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
    </SettingsPage>
  )
}

function HeaderButton({ onClick, strong, children }: { onClick: () => void; strong?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        strong
          ? "h-9 rounded-lg px-2.5 text-[12px] font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-7"
          : "h-9 rounded-lg px-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-7"
      }
    >
      {children}
    </button>
  )
}

function CategorySubtitle({ category }: { category: Category }) {
  const defaults = categoryDefaults(category)
  if (!category.description) return <span className="block truncate">{defaults}</span>
  return (
    <>
      <span className="block truncate">{category.description}</span>
      <span className="block truncate text-[12px]">{defaults}</span>
    </>
  )
}

function ReassignSelect({
  id,
  value,
  onChange,
  options,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  options: WithId<Category>[]
}) {
  const placeholder = "Pick a category"
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? "")}>
      <SelectTrigger id={id} className="h-9 w-full">
        <SelectValue placeholder={placeholder}>
          {(v) => options.find((c) => c.id === v)?.name ?? placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <span aria-hidden className="size-2 shrink-0 self-center rounded-full" style={{ backgroundColor: c.color }} />
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
  const fieldId = useId()
  const [reassignTo, setReassignTo] = useState<string>("")

  const options = useMemo(() => allCategories.filter((c) => c.id !== target?.id), [allCategories, target?.id])

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
            toast.error("Pick a category to move its posts to.", {
              description: "The category is back in the list. Try again and choose where its posts go.",
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
      <DialogContent className="gap-0 sm:max-w-md">
        <DialogHead
          title={target ? `Delete ${target.name}?` : "Delete category?"}
          description="This can't be undone. If posts use this category, choose where they should move."
        />
        <div className="py-4">
          <DialogField title="Move its posts to" hint="Leave empty if no posts use it." htmlFor={fieldId}>
            <ReassignSelect id={fieldId} value={reassignTo} onChange={setReassignTo} options={options} />
          </DialogField>
        </div>
        <DialogFooter>
          <Button variant="ghost" className="h-9 sm:h-8" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button variant="destructive" className="h-9 sm:h-8" onClick={onConfirm}>
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
  const fieldId = useId()
  const [reassignTo, setReassignTo] = useState<string>("")

  const options = useMemo(
    () => allCategories.filter((c) => !selectedIds.includes(c.id)),
    [allCategories, selectedIds],
  )

  const selectedNames = useMemo(
    () => allCategories.filter((c) => selectedIds.includes(c.id)).map((c) => c.name),
    [allCategories, selectedIds],
  )

  const countLabel = plural(selectedIds.length, "category", "categories")

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
        toast.success(`${countLabel} deleted`)
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
      <DialogContent className="gap-0 sm:max-w-md">
        <DialogHead
          title={`Delete ${countLabel}?`}
          description={`${selectedNames.length > 0 ? selectedNames.join(", ") : countLabel} will be removed. This can't be undone.`}
        />
        <div className="py-4">
          <DialogField
            title="Move their posts to"
            hint="Leave empty if none of them have posts."
            htmlFor={fieldId}
          >
            <ReassignSelect id={fieldId} value={reassignTo} onChange={setReassignTo} options={options} />
          </DialogField>
        </div>
        <DialogFooter>
          <Button variant="ghost" className="h-9 sm:h-8" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button variant="destructive" className="h-9 sm:h-8" onClick={onConfirm}>
            Delete {countLabel}
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
  const namesId = useId()
  const [, startTransition] = useTransition()
  const [names, setNames] = useState("")
  const [color, setColor] = useState(DEFAULT_CATEGORY_COLOR)
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
      setColor(DEFAULT_CATEGORY_COLOR)
    }
  }

  function onSubmit() {
    if (parsedNames.length === 0) return
    const items = parsedNames.map((name) => ({ name, color }))

    const now = new Date().toISOString()
    onOptimisticAdd(
      items.map(
        (item, i) =>
          ({
            id: `temp-${now}-${i}`,
            organizationId: "",
            name: item.name,
            slug: item.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "")
              .slice(0, 60),
            color: item.color,
            defaultPostType: "grid",
            defaultHashtags: [],
            isActive: true,
            displayOrder: nextDisplayOrder + i,
            system: false,
            createdAt: now,
            updatedAt: now,
          }) as WithId<Category>,
      ),
    )
    onClose()
    setNames("")
    setColor(DEFAULT_CATEGORY_COLOR)

    setIsSubmitting(true)
    startTransition(async () => {
      const result = await bulkCreateCategories({ items })
      setIsSubmitting(false)
      if (!result.ok) {
        toast.error(result.error ?? "Could not create categories")
      } else {
        toast.success(`${plural(items.length, "category", "categories")} created`)
      }
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="gap-0 sm:max-w-md">
        <DialogHead
          title="Bulk add categories"
          description="One name per line. They all start with the same colour, which you can change one by one later."
        />
        <div className="divide-y divide-border">
          <DialogField
            title="Names"
            htmlFor={namesId}
            hint={
              parsedNames.length > 0 ? (
                <span className="tabular-nums">{plural(parsedNames.length, "category", "categories")} to add</span>
              ) : (
                "Blank lines are skipped."
              )
            }
          >
            <Textarea
              id={namesId}
              autoFocus
              rows={6}
              placeholder={"Event recap\nVolunteer spotlight\nFundraising appeal"}
              value={names}
              onChange={(e) => setNames(e.target.value)}
            />
          </DialogField>
          <DialogField title="Colour">
            <CategoryColorSwatches label="Colour for new categories" value={color} onChange={setColor} />
          </DialogField>
        </div>
        <DialogFooter className="mt-2">
          <Button variant="ghost" className="h-9 sm:h-8" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button className="h-9 sm:h-8" disabled={parsedNames.length === 0 || isSubmitting} onClick={onSubmit}>
            {parsedNames.length > 0 ? `Add ${plural(parsedNames.length, "category", "categories")}` : "Add categories"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

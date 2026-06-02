"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, ChevronsUpDown } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { createQuickAddPost, deletePost } from "@/lib/actions/posts"
import type { Category, Cta, User } from "@/lib/schemas"
import type { WithId } from "@/lib/firebase/serialize"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDate?: Date | null
  initialCategoryId?: string | null
  categories: WithId<Category>[]
  ctas: WithId<Cta>[]
  users: WithId<User>[]
  onCreated?: () => void
  /**
   * Fires after a successful Save (NOT Save & add details). The dialogs
   * provider uses this to optionally navigate to /calendar when Quick add
   * was launched from the TopBar on a non-calendar route.
   */
  onSaved?: (postId: string) => void
  onCreateAndOpenComposer?: (postId: string) => void
}

/*
 * The killer feature: three taps to create a post.
 *   1. Date - defaults to clicked day or today.
 *   2. Category - Combobox over org categories; selecting one reveals the
 *      defaults that will be inherited (lead, post type, CTA).
 *   3. Brief - single-line summary.
 *
 * Save closes the dialog and surfaces an Undo toast that DELETEs the post
 * if pressed within 5 seconds.
 */
export function QuickAddDialog({
  open,
  onOpenChange,
  initialDate,
  initialCategoryId,
  categories,
  ctas,
  users,
  onCreated,
  onSaved,
  onCreateAndOpenComposer,
}: Props) {
  const [date, setDate] = useState<Date>(initialDate ?? new Date())
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [brief, setBrief] = useState("")
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  // Reset form state whenever the dialog opens (or the seed date changes
  // while open). This is a deliberate prop→state sync; the remount-by-key
  // alternative would also work but adds wrapper indirection.
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDate(initialDate ?? new Date())
    setCategoryId(initialCategoryId ?? null)
    setBrief("")
  }, [open, initialDate, initialCategoryId])

  const ctasById = useMemo(() => new Map(ctas.map((c) => [c.id, c])), [ctas])
  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId) ?? null,
    [categories, categoryId],
  )

  const canSubmit = !!categoryId && brief.trim().length > 0 && !pending

  const submit = (openComposer: boolean) => {
    if (!canSubmit) return
    startTransition(async () => {
      const res = await createQuickAddPost({
        scheduledDate: format(date, "yyyy-MM-dd"),
        categoryId,
        brief: brief.trim(),
      })
      if (!res.ok || !res.id) {
        toast.error(res.error ?? "Could not save post")
        return
      }
      onOpenChange(false)
      onCreated?.()
      const newId = res.id
      toast.success(`Saved to ${format(date, "EEE d MMM")}`, {
        action: {
          label: "Undo",
          onClick: () => {
            void deletePost(newId).then(() => onCreated?.())
          },
        },
      })
      if (openComposer) {
        onCreateAndOpenComposer?.(newId)
      } else {
        onSaved?.(newId)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quick add</DialogTitle>
          <DialogDescription>
            Three fields. Flesh out the rest later.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qa-date">Date</Label>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger
                render={
                  <Button
                    id="qa-date"
                    variant="outline"
                    className="justify-start font-normal"
                  />
                }
              >
                <CalendarIcon aria-hidden className="size-4" />
                {format(date, "EEE d MMM yyyy")}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    if (d) {
                      setDate(d)
                      setDatePickerOpen(false)
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qa-category">Category</Label>
            <Popover open={categoryPickerOpen} onOpenChange={setCategoryPickerOpen}>
              <PopoverTrigger
                render={
                  <Button
                    id="qa-category"
                    variant="outline"
                    role="combobox"
                    aria-expanded={categoryPickerOpen}
                    className="justify-between font-normal"
                  />
                }
              >
                {selectedCategory ? (
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: selectedCategory.color }}
                    />
                    {selectedCategory.name}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Pick a category</span>
                )}
                <ChevronsUpDown aria-hidden className="size-4 opacity-50" />
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
                <Command>
                  <CommandInput placeholder="Search categories..." />
                  <CommandList>
                    <CommandEmpty>No category found.</CommandEmpty>
                    <CommandGroup>
                      {categories.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={`${c.name} ${c.slug}`}
                          onSelect={() => {
                            setCategoryId(c.id)
                            setCategoryPickerOpen(false)
                          }}
                        >
                          <span
                            aria-hidden
                            className="size-2.5 rounded-full"
                            style={{ backgroundColor: c.color }}
                          />
                          <span>{c.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedCategory ? (
              <p className="text-xs text-muted-foreground">
                Defaults applied: type {selectedCategory.defaultPostType}
                {selectedCategory.defaultCtaId
                  ? `, CTA ${ctasById.get(selectedCategory.defaultCtaId)?.label ?? "-"}`
                  : ""}
                {selectedCategory.defaultLeadId
                  ? `, lead ${usersById.get(selectedCategory.defaultLeadId)?.name ?? "-"}`
                  : ""}
              </p>
            ) : null}
          </div>

          {/* Brief */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qa-brief">Brief</Label>
            <Input
              id="qa-brief"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Photo of weekly raffle"
              maxLength={280}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && canSubmit) {
                  e.preventDefault()
                  submit(false)
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              One line - flesh out later.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => submit(true)}
            disabled={!canSubmit}
          >
            Save & add details
          </Button>
          <Button onClick={() => submit(false)} disabled={!canSubmit}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

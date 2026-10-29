"use client"

import { useId } from "react"
import Link from "next/link"
import type { WithId } from "@/lib/firebase/serialize"
import type { Category } from "@/lib/schemas"
import { Checkbox } from "@/components/ui/checkbox"
import { DisclosureBody, DisclosureTrigger, useRemembered } from "@/components/ui/disclosure"

type Props = {
  categories: WithId<Category>[]
  visibleIds: Set<string>
  onToggle: (id: string) => void
  onAll: () => void
  onNone: () => void
}

/*
 * Sidebar filter - toggle which categories' events render on the grid.
 * `visibleIds` size === categories.length means all are visible.
 */
export function CategoryFilter({
  categories,
  visibleIds,
  onToggle,
  onAll,
  onNone,
}: Props) {
  const [open, setOpen] = useRemembered("calendar.categories", true)
  const bodyId = useId()
  const shown = categories.filter((c) => visibleIds.has(c.id)).length

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <DisclosureTrigger
          heading={3}
          open={open}
          onOpenChange={setOpen}
          controls={bodyId}
          chevronClassName="size-3.5"
          className="min-w-0 flex-1 gap-1.5 rounded-sm"
        >
          <span className="text-caption uppercase tracking-wider text-muted-foreground">
            Categories
          </span>
          {!open && (
            <span className="min-w-0 truncate text-[11px] tabular-nums text-muted-foreground">
              {shown} of {categories.length} shown
            </span>
          )}
        </DisclosureTrigger>
        <div className="flex shrink-0 gap-2 text-[11px]">
          <button
            type="button"
            onClick={onAll}
            className="text-muted-foreground hover:text-foreground"
          >
            All
          </button>
          <span className="text-muted-foreground/40">·</span>
          <button
            type="button"
            onClick={onNone}
            className="text-muted-foreground hover:text-foreground"
          >
            None
          </button>
        </div>
      </div>
      <DisclosureBody id={bodyId} open={open} className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1">
        {categories.map((c) => (
          <li key={c.id}>
            <div className="flex items-center gap-2 text-xs py-0.5">
              <Checkbox
                id={`cat-filter-${c.id}`}
                checked={visibleIds.has(c.id)}
                onCheckedChange={() => onToggle(c.id)}
              />
              <label
                htmlFor={`cat-filter-${c.id}`}
                className="flex items-center gap-2 cursor-pointer hover:text-foreground flex-1 min-w-0"
              >
                <span
                  aria-hidden
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: c.color }}
                />
                <span className="truncate">{c.name}</span>
              </label>
            </div>
          </li>
        ))}
      </ul>
      <Link
        href="/settings/categories"
        className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
      >
        Manage categories
      </Link>
      </DisclosureBody>
    </div>
  )
}

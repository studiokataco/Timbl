"use client"

import Link from "next/link"
import type { WithId } from "@/lib/firebase/serialize"
import type { Category } from "@/lib/schemas"
import { Checkbox } from "@/components/ui/checkbox"

type Props = {
  categories: WithId<Category>[]
  visibleIds: Set<string>
  onToggle: (id: string) => void
  onAll: () => void
  onNone: () => void
}

export function CategoryFilter({ categories, visibleIds, onToggle, onAll, onNone }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {categories.length > 0 ? (
        <div className="flex justify-end gap-1 text-xs">
          <button type="button" onClick={onAll} className="min-h-11 min-w-11 rounded-md text-muted-foreground hover:text-foreground">All</button>
          <button type="button" onClick={onNone} className="min-h-11 min-w-11 rounded-md text-muted-foreground hover:text-foreground">None</button>
        </div>
      ) : null}
      {categories.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {categories.map((category) => (
            <li key={category.id}>
              <div className="flex min-h-11 items-center gap-2 text-xs">
                <Checkbox
                  id={`cat-filter-${category.id}`}
                  checked={visibleIds.has(category.id)}
                  onCheckedChange={() => onToggle(category.id)}
                />
                <label
                  htmlFor={`cat-filter-${category.id}`}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 hover:text-foreground"
                >
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="truncate">{category.name}</span>
                </label>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No categories to filter.</p>
      )}
      <Link
        href="/settings/categories"
        className="flex min-h-11 items-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        Manage categories
      </Link>
    </div>
  )
}

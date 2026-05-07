"use client"

import { Plus } from "lucide-react"

type Props = {
  onClick: () => void
}

/*
 * Dashed-border placeholder card at the right of the column row. Clicking
 * opens the column-edit-dialog in "create" mode.
 */
export function KanbanColumnAddButton({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 w-[200px] shrink-0 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors min-h-full"
    >
      <Plus aria-hidden className="size-5" />
      <span className="text-xs font-medium">Add column</span>
    </button>
  )
}

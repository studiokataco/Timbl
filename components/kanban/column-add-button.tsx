"use client"

import { Plus } from "lucide-react"

export function KanbanColumnAddButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex shrink-0 flex-col pt-10">
      <button
        type="button"
        onClick={onClick}
        aria-label="Add column"
        title="Add column"
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground outline-none transition-colors duration-150 hover:border-foreground/30 hover:bg-secondary/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus aria-hidden className="size-4" />
      </button>
    </div>
  )
}

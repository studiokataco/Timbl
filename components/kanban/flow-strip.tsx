"use client"

import type { WithId } from "@/lib/firebase/serialize"
import type { KanbanColumn } from "@/lib/schemas"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type Props = {
  columns: WithId<KanbanColumn>[]
  counts: ReadonlyMap<string, number>
  onJump: (columnId: string) => void
  className?: string
}

export function FlowStrip({ columns, counts, onJump, className }: Props) {
  const total = columns.reduce((s, c) => s + (counts.get(c.id) ?? 0), 0)
  if (total === 0) return null
  const filled = columns.filter((c) => (counts.get(c.id) ?? 0) > 0)

  return (
    <div
      role="group"
      aria-label="Posts per stage"
      className={cn("flex h-2 w-full gap-0.5", className)}
    >
      {filled.map((c) => {
        const n = counts.get(c.id) ?? 0
        return (
          <Tooltip key={c.id}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => onJump(c.id)}
                  aria-label={`${c.label}: ${n} ${n === 1 ? "post" : "posts"}. Jump to column`}
                  className="h-full min-w-2 rounded-full outline-none transition-[filter,transform] duration-150 ease-out first:rounded-l-full hover:brightness-110 hover:scale-y-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:hover:scale-y-100"
                  style={{ flexGrow: n, flexBasis: 0, backgroundColor: c.color }}
                />
              }
            />
            <TooltipContent>
              <span className="font-medium">{c.label}</span>
              <span className="ml-1.5 tabular-nums text-muted-foreground">{n}</span>
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}

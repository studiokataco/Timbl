"use client"

import { format } from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { buildMonthGrid } from "@/lib/calendar/grid-layout"
import { cn } from "@/lib/utils"

const DAY_NAMES = ["M", "T", "W", "T", "F", "S", "S"]

type Props = {
  visibleMonth: Date
  selectedDate: Date | null
  onSelectDate: (d: Date) => void
  onPrev: () => void
  onNext: () => void
}

export function MiniCalendar({
  visibleMonth,
  selectedDate,
  onSelectDate,
  onPrev,
  onNext,
}: Props) {
  const weeks = useMemo(() => buildMonthGrid(visibleMonth), [visibleMonth])

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">
          {format(visibleMonth, "MMMM yyyy")}
        </span>
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrev}
            aria-label="Previous month"
            className="size-7"
          >
            <ChevronLeft aria-hidden className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            aria-label="Next month"
            className="size-7"
          >
            <ChevronRight aria-hidden className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 text-center text-[10px] text-muted-foreground mb-1">
        {DAY_NAMES.map((n, i) => (
          <span key={i}>{n}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {weeks.flatMap((week) =>
          week.cells.map((cell) => {
            const isSelected = selectedDate
              ? cell.iso === format(selectedDate, "yyyy-MM-dd")
              : false
            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() => onSelectDate(cell.date)}
                className={cn(
                  "size-7 rounded-full text-[11px] tabular-nums transition-colors",
                  cell.isToday && !isSelected && "ring-1 ring-foreground",
                  isSelected && "bg-foreground text-background font-semibold",
                  !isSelected && cell.isCurrentMonth && "hover:bg-secondary/60",
                  !cell.isCurrentMonth && "text-muted-foreground/50",
                )}
              >
                {format(cell.date, "d")}
              </button>
            )
          }),
        )}
      </div>
    </div>
  )
}

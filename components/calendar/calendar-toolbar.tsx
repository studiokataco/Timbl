"use client"

import { format } from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type CalendarView = "month" | "week" | "day"

type Props = {
  visibleMonth: Date
  view: CalendarView
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onViewChange: (v: CalendarView) => void
}

/*
 * Toolbar above the calendar grid: Today / chevrons / month label on the
 * left; view selector on the right. Matches the 21st.dev event-manager
 * layout — no "+ New event" button (TopBar Quick add handles creation).
 */
export function CalendarToolbar({
  visibleMonth,
  view,
  onPrev,
  onNext,
  onToday,
  onViewChange,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onToday}>
          Today
        </Button>
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrev}
            aria-label="Previous month"
            className="size-8"
          >
            <ChevronLeft aria-hidden className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            aria-label="Next month"
            className="size-8"
          >
            <ChevronRight aria-hidden className="size-4" />
          </Button>
        </div>
        <h2 className="text-display-sm text-foreground ml-2">
          {format(visibleMonth, "MMMM yyyy")}
        </h2>
      </div>
      <Select
        value={view}
        onValueChange={(v) => onViewChange((v ?? "month") as CalendarView)}
      >
        <SelectTrigger className="w-32" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="month">Month</SelectItem>
          <SelectItem value="week">Week</SelectItem>
          <SelectItem value="day">Day</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

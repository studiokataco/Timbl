"use client"

import { format } from "date-fns"
import { Calendar, ChevronLeft, ChevronRight, Clock, Grid3x3, List } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type CalendarView = "month" | "week" | "day" | "list"

type Props = {
  visibleDate: Date
  view: CalendarView
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onViewChange: (v: CalendarView) => void
}

const VIEW_LABEL: Record<CalendarView, string> = {
  month: "Month",
  week: "Week",
  day: "Day",
  list: "List",
}

function viewLabel(view: CalendarView, date: Date): string {
  if (view === "week") return `Week of ${format(date, "d MMM")}`
  if (view === "day") return format(date, "EEEE, d MMM yyyy")
  if (view === "list") return "All posts"
  return format(date, "MMMM yyyy")
}

const VIEWS: { value: CalendarView; icon: React.ReactNode; label: string }[] = [
  { value: "month", icon: <Calendar className="size-3.5" aria-hidden />, label: "Month" },
  { value: "week", icon: <Grid3x3 className="size-3.5" aria-hidden />, label: "Week" },
  { value: "day", icon: <Clock className="size-3.5" aria-hidden />, label: "Day" },
  { value: "list", icon: <List className="size-3.5" aria-hidden />, label: "List" },
]

export function CalendarToolbar({
  visibleDate,
  view,
  onPrev,
  onNext,
  onToday,
  onViewChange,
}: Props) {
  const prevLabel =
    view === "week" ? "Previous week" : view === "day" ? "Previous day" : "Previous month"
  const nextLabel =
    view === "week" ? "Next week" : view === "day" ? "Next day" : "Next month"

  return (
    <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onToday}>
          Today
        </Button>
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrev}
            aria-label={prevLabel}
            className="size-8"
          >
            <ChevronLeft aria-hidden className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            aria-label={nextLabel}
            className="size-8"
          >
            <ChevronRight aria-hidden className="size-4" />
          </Button>
        </div>
        <h2 className="text-display-sm text-foreground ml-1">
          {viewLabel(view, visibleDate)}
        </h2>
      </div>

      {/* Desktop: button group */}
      <div className="hidden sm:flex items-center gap-1 rounded-lg border border-border bg-background p-1">
        {VIEWS.map((v) => (
          <Button
            key={v.value}
            variant={view === v.value ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onViewChange(v.value)}
            className="h-8 gap-1.5"
          >
            {v.icon}
            {v.label}
          </Button>
        ))}
      </div>

      {/* Mobile: select */}
      <div className="sm:hidden">
        <Select
          value={view}
          onValueChange={(v) => onViewChange((v ?? "month") as CalendarView)}
        >
          <SelectTrigger className="w-32" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VIEWS.map((v) => (
              <SelectItem key={v.value} value={v.value}>
                <span className={cn("flex items-center gap-2")}>
                  {v.icon}
                  {v.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

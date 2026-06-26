"use client"

import { format } from "date-fns"
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Grid3x3,
  List,
  SlidersHorizontal,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type CalendarView = "month" | "week" | "day" | "list"

type Props = {
  visibleDate: Date
  view: CalendarView
  onPrev: () => void
  onNext: () => void
  onViewChange: (v: CalendarView) => void
  onOpenFilters?: () => void
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
  { value: "day", icon: <Clock className="size-3.5" aria-hidden />, label: "Today" },
  { value: "list", icon: <List className="size-3.5" aria-hidden />, label: "List" },
]

function ViewMenu({
  view,
  onViewChange,
}: {
  view: CalendarView
  onViewChange: (v: CalendarView) => void
}) {
  const current = VIEWS.find((v) => v.value === view) ?? VIEWS[0]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 pr-2"
          />
        }
      >
        {current.icon}
        {current.label}
        <ChevronDown aria-hidden className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-36">
        {VIEWS.map((v) => (
          <DropdownMenuItem
            key={v.value}
            onClick={() => onViewChange(v.value)}
            className="gap-2"
          >
            {v.icon}
            {v.label}
            {view === v.value ? (
              <Check aria-hidden className="ml-auto size-3.5" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function CalendarToolbar({
  visibleDate,
  view,
  onPrev,
  onNext,
  onViewChange,
  onOpenFilters,
}: Props) {
  const prevLabel =
    view === "week" ? "Previous week" : view === "day" ? "Previous day" : "Previous month"
  const nextLabel =
    view === "week" ? "Next week" : view === "day" ? "Next day" : "Next month"
  const title = viewLabel(view, visibleDate)

  return (
    <>
      <div className="relative sm:hidden mb-4 flex items-center justify-between min-h-9">
        <div className="relative z-10">
          <ViewMenu view={view} onViewChange={onViewChange} />
        </div>

        <div className="pointer-events-none absolute inset-x-0 flex justify-center">
          <div className="pointer-events-auto flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={onPrev}
              aria-label={prevLabel}
              className="size-8 shrink-0"
            >
              <ChevronLeft aria-hidden className="size-4" />
            </Button>
            <h2 className="text-sm font-semibold text-foreground px-1 whitespace-nowrap">
              {title}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNext}
              aria-label={nextLabel}
              className="size-8 shrink-0"
            >
              <ChevronRight aria-hidden className="size-4" />
            </Button>
          </div>
        </div>

        {onOpenFilters ? (
          <Button
            variant="outline"
            size="icon"
            onClick={onOpenFilters}
            aria-label="Filters and insights"
            className="relative z-10 size-8 shrink-0"
          >
            <SlidersHorizontal aria-hidden className="size-4" />
          </Button>
        ) : (
          <span aria-hidden className="size-8 shrink-0" />
        )}
      </div>

      <div className="hidden sm:flex mb-4 items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
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
          <h2 className="text-display-sm text-foreground ml-1 truncate min-w-0">
            {title}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
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
          {onOpenFilters ? (
            <Button
              variant="outline"
              size="icon"
              className="hidden sm:inline-flex lg:hidden size-9 shrink-0"
              onClick={onOpenFilters}
              aria-label="Filters and insights"
            >
              <SlidersHorizontal aria-hidden className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </>
  )
}

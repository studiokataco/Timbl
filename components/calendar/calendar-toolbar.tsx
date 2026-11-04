"use client"

import { format, startOfWeek } from "date-fns"
import { weekLabel } from "@/components/agentic/clock"
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Grid3x3,
  List,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { usePrototype } from "@/components/agentic/prototype-context"
import type { CalendarFilter } from "@/components/agentic/types"

export type CalendarView = "month" | "week" | "day" | "list"

type Props = {
  visibleDate: Date
  view: CalendarView
  filter: CalendarFilter
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onViewChange: (v: CalendarView) => void
  onFilterChange: (v: CalendarFilter) => void
}

function viewTitle(view: CalendarView, date: Date): string {
  if (view === "week") return weekLabel(format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd"))
  if (view === "day") return format(date, "EEEE, d MMM yyyy")
  if (view === "list") return format(date, "MMMM yyyy")
  return format(date, "MMMM yyyy")
}

const VIEWS: { value: CalendarView; icon: React.ReactNode; label: string }[] = [
  { value: "month", icon: <Calendar className="size-3.5" aria-hidden />, label: "Month" },
  { value: "week", icon: <Grid3x3 className="size-3.5" aria-hidden />, label: "Week" },
  { value: "day", icon: <Clock className="size-3.5" aria-hidden />, label: "Day" },
  { value: "list", icon: <List className="size-3.5" aria-hidden />, label: "List" },
]

const FILTERS: CalendarFilter[] = ["all", "drafts", "scheduled", "needs-approval", "sent"]

export function CalendarToolbar({
  visibleDate,
  view,
  filter,
  onPrev,
  onNext,
  onToday,
  onViewChange,
  onFilterChange,
}: Props) {
  const { copy } = usePrototype()
  const c = copy.iface.calendar
  const prevLabel =
    view === "week" ? c.prev : view === "day" ? "Previous day" : "Previous month"
  const nextLabel =
    view === "week" ? c.next : view === "day" ? "Next day" : "Next month"
  const title = viewTitle(view, visibleDate)
  const current = VIEWS.find((item) => item.value === view) ?? VIEWS[0]

  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-1">
        <p className="min-w-0 truncate text-title-sm font-semibold text-foreground">{title}</p>
        <Button variant="ghost" size="icon" onClick={onPrev} aria-label={prevLabel} className="ml-1 size-8 shrink-0">
          <ChevronLeft aria-hidden className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onNext} aria-label={nextLabel} className="size-8 shrink-0">
          <ChevronRight aria-hidden className="size-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={onToday} className="ml-1 shrink-0">
          {c.today}
        </Button>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Select
          items={FILTERS.map((item) => ({ value: item, label: c.filters[item] }))}
          value={filter}
          onValueChange={(value) => value && onFilterChange(value as CalendarFilter)}
        >
          <SelectTrigger size="sm" aria-label={c.statusLabel} className="min-w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.map((item) => (
              <SelectItem key={item} value={item}>
                {c.filters[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" aria-label={current.label} className="shrink-0 gap-1.5 pr-2" />
            }
          >
            {current.icon}
            <span className="hidden @md/iface:inline">{current.label}</span>
            <ChevronDown aria-hidden className="size-3.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-36">
            {VIEWS.map((item) => (
              <DropdownMenuItem key={item.value} onClick={() => onViewChange(item.value)} className="gap-2">
                {item.icon}
                {item.label}
                {view === item.value ? <Check aria-hidden className="ml-auto size-3.5" /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

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
  Ellipsis,
  Menu,
  PanelRight,
  Plus,
  Search,
  Sparkles,
} from "lucide-react"
import { useTheme } from "@/components/shared/theme-provider"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  onOpenTimbl: () => void
  onCreate: () => void
  onSearch: () => void
  onMenu?: () => void
  onOverview?: () => void
  overviewOpen?: boolean
  density: "touch" | "pointer"
  notifications?: React.ReactNode
  presence?: React.ReactNode
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
  onOpenTimbl,
  onCreate,
  onSearch,
  onMenu,
  onOverview,
  overviewOpen = false,
  density,
  notifications,
  presence,
}: Props) {
  const { copy } = usePrototype()
  const { resolvedTheme, setTheme } = useTheme()
  const c = copy.iface.calendar
  const prevLabel =
    view === "week" ? c.prev : view === "day" ? "Previous day" : "Previous month"
  const nextLabel =
    view === "week" ? c.next : view === "day" ? "Next day" : "Next month"
  const title = viewTitle(view, visibleDate)
  const current = VIEWS.find((item) => item.value === view) ?? VIEWS[0]
  const touchClass = density === "touch" ? "size-11 h-11" : "size-9 h-9"
  const iconButtonClass = `inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground ${touchClass}`
  const barControlClass = `${density === "touch" ? "h-11" : "h-9"} rounded-md`

  return (
    <div className="@container/calbar mb-4 flex shrink-0 flex-col gap-2">
      <p className="truncate text-body-sm font-medium text-foreground @min-[30rem]/calbar:hidden">{title}</p>
      <div className="flex min-w-0 flex-nowrap items-center gap-2">
        {onMenu ? (
          <button type="button" onClick={onMenu} aria-label="Open navigation" className={`${iconButtonClass} @3xl/iface:hidden`}>
            <Menu aria-hidden className="size-4" />
          </button>
        ) : null}
        <p className="hidden min-w-0 shrink truncate text-body-sm font-medium text-foreground @min-[30rem]/calbar:block @min-[52rem]/calbar:max-w-none max-w-36">{title}</p>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="outline" size="icon-lg" onClick={onPrev} aria-label={prevLabel} className={`${barControlClass} ${touchClass}`}>
            <ChevronLeft aria-hidden className="size-4" />
          </Button>
          <Button variant="outline" size="icon-lg" onClick={onNext} aria-label={nextLabel} className={`${barControlClass} ${touchClass}`}>
            <ChevronRight aria-hidden className="size-4" />
          </Button>
        </div>
        <Button variant="outline" size="lg" onClick={onToday} className={`${barControlClass} hidden px-3 @min-[24rem]/calbar:inline-flex`}>
          {c.today}
        </Button>
        <div className="hidden shrink-0 items-center gap-1 @min-[40rem]/calbar:flex">
          <Select
            items={FILTERS.map((item) => ({ value: item, label: c.filters[item] }))}
            value={filter}
            onValueChange={(value) => value && onFilterChange(value as CalendarFilter)}
          >
            <SelectTrigger aria-label={c.statusLabel} className={`${barControlClass} w-fit max-w-36 px-2.5`}>
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
                <Button variant="outline" size="lg" aria-label={current.label} className={`${barControlClass} gap-1.5 px-2.5`} />
              }
            >
              {current.icon}
              <span>{current.label}</span>
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
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {presence}
          <div className="hidden items-center gap-1 @min-[52rem]/calbar:flex">
            <button type="button" onClick={onSearch} aria-label="Search" className={iconButtonClass}>
              <Search aria-hidden className="size-4" />
            </button>
            <ThemeToggle className={`${touchClass} rounded-md border border-border bg-background text-muted-foreground hover:bg-secondary/40 hover:text-foreground`} />
            <button type="button" onClick={onOpenTimbl} aria-label="Open Timbl mode" className={iconButtonClass}>
              <Sparkles aria-hidden className="size-4" />
            </button>
          </div>
          {notifications}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="icon-lg" aria-label="More" className={`${barControlClass} ${touchClass} @min-[52rem]/calbar:hidden`} />}
            >
              <Ellipsis aria-hidden className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              {onOverview ? <DropdownMenuItem onClick={onOverview}>{c.overview}</DropdownMenuItem> : null}
              {onOverview ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem className="@min-[24rem]/calbar:hidden" onClick={onToday}>{c.today}</DropdownMenuItem>
              {FILTERS.map((item) => (
                <DropdownMenuItem key={item} onClick={() => onFilterChange(item)}>
                  {c.filters[item]}
                  {filter === item ? <Check aria-hidden className="ml-auto size-3.5" /> : null}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {VIEWS.map((item) => (
                <DropdownMenuItem key={item.value} onClick={() => onViewChange(item.value)}>
                  {item.label}
                  {view === item.value ? <Check aria-hidden className="ml-auto size-3.5" /> : null}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSearch}>Search</DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenTimbl}>Open Timbl mode</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
                {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="lg" onClick={onCreate} aria-label="Create a post" className={`${barControlClass} ${density === "touch" ? "min-w-11" : ""} px-2.5 @min-[30rem]/calbar:px-3`}>
            <Plus aria-hidden className="size-4" />
            <span className="sr-only @min-[30rem]/calbar:not-sr-only">Create</span>
          </Button>
          {onOverview ? (
            <button
              type="button"
              onClick={onOverview}
              aria-label={c.overview}
              className={`${iconButtonClass} ${overviewOpen ? "@7xl/iface:hidden" : ""} @max-[22rem]/calbar:hidden`}
            >
              <PanelRight aria-hidden className="size-4" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

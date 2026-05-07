import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
} from "date-fns"

export type WeekStart = 0 | 1 // 0 = Sun, 1 = Mon

export type CalendarCell = {
  date: Date
  iso: string // yyyy-MM-dd
  isCurrentMonth: boolean
  isToday: boolean
  weekIndex: number // 0..N-1
  dayIndex: number // 0..6
}

export type CalendarWeek = {
  index: number
  start: Date
  cells: CalendarCell[]
}

/*
 * Build a 6-row × 7-col grid covering the visible month, padded with
 * leading/trailing days from the adjacent months. Week starts on Monday by
 * default to match the rest of the app (FullCalendar `firstDay: 1`).
 */
export function buildMonthGrid(
  visibleMonth: Date,
  options: { weekStartsOn?: WeekStart } = {},
): CalendarWeek[] {
  const weekStartsOn = options.weekStartsOn ?? 1
  const today = new Date()
  const start = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn })
  const end = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn })
  const totalDays = differenceInCalendarDays(end, start) + 1

  const weeks: CalendarWeek[] = []
  for (let i = 0; i < totalDays; i++) {
    const d = addDays(start, i)
    const weekIdx = Math.floor(i / 7)
    const dayIdx = i % 7
    if (!weeks[weekIdx]) {
      weeks[weekIdx] = { index: weekIdx, start: d, cells: [] }
    }
    weeks[weekIdx].cells.push({
      date: d,
      iso: format(d, "yyyy-MM-dd"),
      isCurrentMonth: isSameMonth(d, visibleMonth),
      isToday: isSameDay(d, today),
      weekIndex: weekIdx,
      dayIndex: dayIdx,
    })
  }
  return weeks
}

/*
 * Given an event spanning [start, end] (inclusive), return the segments
 * needed to render it as multi-week bars: one segment per week the event
 * intersects, with that week's startCol / endCol clamped to the visible
 * range.
 */
export type EventSegment = {
  weekIndex: number
  startCol: number // 0..6
  endCol: number // 0..6 (inclusive)
}

export function eventSegments(
  range: { start: Date; end: Date },
  weeks: CalendarWeek[],
): EventSegment[] {
  const segments: EventSegment[] = []
  for (const week of weeks) {
    const weekStart = week.cells[0].date
    const weekEnd = week.cells[6].date
    if (range.end < weekStart || range.start > weekEnd) continue
    const segStart = range.start < weekStart ? weekStart : range.start
    const segEnd = range.end > weekEnd ? weekEnd : range.end
    const startCol = differenceInCalendarDays(segStart, weekStart)
    const endCol = differenceInCalendarDays(segEnd, weekStart)
    segments.push({ weekIndex: week.index, startCol, endCol })
  }
  return segments
}

export function isWithinRange(date: Date, range: { start: Date; end: Date }): boolean {
  return isWithinInterval(date, range)
}

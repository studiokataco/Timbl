import type { WeekId } from "./types"

export function nowMs(): number {
  return Date.now()
}

export const FIXTURE_NOW_MS = nowMs()
export const FIXTURE_NOW_ISO = new Date().toISOString()

function todayIso(): string {
  return localDateOf(nowMs())
}
const DAY_MS = 86_400_000
const FIXTURE_OFFSET_MS = 330 * 60_000
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const

function parts(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number)
  return { y, m, d }
}

function noonMs(date: string): number {
  const { y, m, d } = parts(date)
  return Date.UTC(y, m - 1, d, 12)
}

function toDate(ms: number): string {
  const day = new Date(ms)
  const y = day.getUTCFullYear()
  const m = String(day.getUTCMonth() + 1).padStart(2, "0")
  const d = String(day.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function localDateOf(ms: number): string {
  return toDate(ms + FIXTURE_OFFSET_MS)
}

export function addDays(date: string, n: number): string {
  return toDate(noonMs(date) + n * DAY_MS)
}

export function daysUntil(date: string): number {
  return Math.round((noonMs(date) - noonMs(todayIso())) / DAY_MS)
}

export function formatDay(date: string): string {
  const day = new Date(noonMs(date))
  return `${WEEKDAYS[day.getUTCDay()]} ${day.getUTCDate()} ${MONTHS[day.getUTCMonth()]}`
}

export function formatDayShort(date: string): string {
  const day = new Date(noonMs(date))
  return `${WEEKDAYS[day.getUTCDay()]} ${day.getUTCDate()}`
}

export function formatTime(time: string): string {
  return time.slice(0, 5)
}

export function formatWhen(date: string, time: string): string {
  const offset = daysUntil(date)
  const lead = offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : formatDay(date)
  return `${lead}, ${formatTime(time)}`
}

export function formatRelative(iso: string, nowMs: number = FIXTURE_NOW_MS): string {
  const at = Date.parse(iso)
  const diff = nowMs - at
  if (diff < 60_000) return "Just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`
  const atDay = localDateOf(at)
  const nowDay = localDateOf(nowMs)
  if (atDay === nowDay) return `${Math.floor(diff / 3_600_000)} h ago`
  if (atDay === addDays(nowDay, -1)) return "Yesterday"
  return formatDay(atDay)
}

export function mondayOf(date: string): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return date
  const dow = new Date(noonMs(date)).getUTCDay()
  return addDays(date, dow === 0 ? -6 : 1 - dow)
}

export function weekShort(week: WeekId | string): string {
  if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(week)) return ""
  const start = new Date(noonMs(mondayOf(week)))
  const end = new Date(noonMs(addDays(mondayOf(week), 6)))
  const startMonth = MONTHS[start.getUTCMonth()]
  const endMonth = MONTHS[end.getUTCMonth()]
  if (startMonth === endMonth) return `${start.getUTCDate()}-${end.getUTCDate()} ${endMonth}`
  return `${start.getUTCDate()} ${startMonth}-${end.getUTCDate()} ${endMonth}`
}

export function weekLabel(week: WeekId | string): string {
  const start = new Date(noonMs(week))
  const end = new Date(noonMs(addDays(week, 6)))
  const startMonth = MONTHS[start.getUTCMonth()]
  const endMonth = MONTHS[end.getUTCMonth()]
  const year = end.getUTCFullYear()
  if (startMonth === endMonth) return `${start.getUTCDate()} to ${end.getUTCDate()} ${endMonth} ${year}`
  return `${start.getUTCDate()} ${startMonth} to ${end.getUTCDate()} ${endMonth} ${year}`
}

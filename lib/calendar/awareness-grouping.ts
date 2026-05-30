import { addDays, differenceInCalendarDays, parseISO } from "date-fns"
import type { WithId } from "@/lib/firebase/serialize"
import type { AwarenessDay } from "@/lib/schemas"

export type AwarenessRange = {
  id: string // joined ids of source records
  name: string
  importance: AwarenessDay["importance"]
  start: Date
  end: Date // inclusive
  /** Source records that compose this range (1..N). */
  sources: WithId<AwarenessDay>[]
}

/*
 * Group consecutive AwarenessDay records by name + importance into ranges
 * so multi-day observances (e.g. Mental Health Awareness Week is stored as
 * 7 separate dates) render as a single continuous bar across the calendar.
 * Single-day awareness records pass through unchanged as a 1-day range.
 */
export function groupAwarenessRanges(
  days: WithId<AwarenessDay>[],
): AwarenessRange[] {
  if (days.length === 0) return []

  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const buckets = new Map<string, WithId<AwarenessDay>[]>()
  for (const d of sorted) {
    const key = `${d.name}__${d.importance}`
    const arr = buckets.get(key) ?? []
    arr.push(d)
    buckets.set(key, arr)
  }

  const ranges: AwarenessRange[] = []
  for (const [key, group] of buckets) {
    let runStart = parseISO(group[0].date)
    let runEnd = runStart
    let runSources: WithId<AwarenessDay>[] = [group[0]]
    for (let i = 1; i < group.length; i++) {
      const next = parseISO(group[i].date)
      if (differenceInCalendarDays(next, runEnd) === 1) {
        runEnd = next
        runSources.push(group[i])
      } else {
        ranges.push(rangeFrom(key, runStart, runEnd, runSources))
        runStart = next
        runEnd = next
        runSources = [group[i]]
      }
    }
    ranges.push(rangeFrom(key, runStart, runEnd, runSources))
  }
  return ranges.sort((a, b) => a.start.getTime() - b.start.getTime())
}

function rangeFrom(
  key: string,
  start: Date,
  end: Date,
  sources: WithId<AwarenessDay>[],
): AwarenessRange {
  const [name, importance] = key.split("__") as [string, AwarenessDay["importance"]]
  return {
    id: sources.map((s) => s.id).join("+"),
    name,
    importance,
    start,
    end,
    sources,
  }
}

export function rangeLengthDays(r: AwarenessRange): number {
  return differenceInCalendarDays(r.end, r.start) + 1
}

/** Helper for tests / debugging - render each day in a range. */
export function expandRange(r: AwarenessRange): Date[] {
  const days: Date[] = []
  for (let i = 0; i <= differenceInCalendarDays(r.end, r.start); i++) {
    days.push(addDays(r.start, i))
  }
  return days
}

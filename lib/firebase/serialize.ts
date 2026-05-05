import { Timestamp } from "firebase-admin/firestore"

/*
 * Firestore Admin returns Timestamp objects for date fields. The application
 * boundary uses ISO strings (YYYY-MM-DD for dates, full ISO for timestamps)
 * so React Server Components can hand data to Client Components without
 * serialization gymnastics.
 *
 * `toIso` walks a doc shallowly and replaces Timestamps; `fromDocSnap` is the
 * convenience wrapper used by every read.
 */

export function toIso(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (Array.isArray(value)) return value.map(toIso)
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = toIso(v)
    }
    return out
  }
  return value
}

export type WithId<T> = T & { id: string }

export function snapToData<T>(snap: {
  id: string
  data: () => Record<string, unknown> | undefined
}): WithId<T> {
  const data = snap.data() ?? {}
  return { ...(toIso(data) as Record<string, unknown>), id: snap.id } as WithId<T>
}

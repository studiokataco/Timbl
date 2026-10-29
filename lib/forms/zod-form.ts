import type { FieldValues, Path, UseFormSetError } from "react-hook-form"
import type { z } from "zod"

export function parseInto<T extends FieldValues>(
  schema: z.ZodType<T>,
  values: T,
  setError: UseFormSetError<T>,
): T | null {
  const parsed = schema.safeParse(values)
  if (parsed.success) return parsed.data
  for (const issue of parsed.error.issues) {
    const key = issue.path[0]
    if (typeof key === "string") setError(key as Path<T>, { message: issue.message })
  }
  return null
}

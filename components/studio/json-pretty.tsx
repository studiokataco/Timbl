"use client"

/*
 * Shared in-house JSON colorizer.
 *
 * Extracted from `run-timeline.tsx` in Phase C so the agent playground's
 * chat surface (`agent-chat.tsx` tool-call chiclets) can reuse exactly
 * the same visual rhythm without pulling in Shiki. Keys render muted,
 * strings inherit ink, numbers go emerald, literals go violet.
 *
 * `<JsonPretty data={…} />` is the high-level entry; `<JsonHighlight
 * json={…} />` is the raw tokenizer in case the caller already holds the
 * stringified form.
 */

import { cn } from "@/lib/utils"

export function JsonPretty({
  data,
  className,
}: {
  data: unknown
  className?: string
}) {
  if (data == null) return null
  const json = safeStringify(data)
  return (
    <pre
      className={cn(
        "text-[11px] font-mono leading-relaxed text-foreground/90 whitespace-pre-wrap break-words overflow-x-auto max-h-[280px]",
        className,
      )}
    >
      <JsonHighlight json={json} />
    </pre>
  )
}

export function JsonHighlight({ json }: { json: string }) {
  const tokens = json.split(
    /("(?:\\.|[^"\\])*"(?:\s*:)?|true|false|null|-?\d+(?:\.\d+)?)/g,
  )
  return (
    <>
      {tokens.map((t, i) => {
        if (!t) return null
        if (/^".*":?$/.test(t)) {
          const isKey = t.endsWith(":")
          if (isKey) {
            return (
              <span key={i} className="text-muted-foreground">
                {t}
              </span>
            )
          }
          return (
            <span key={i} className="text-foreground">
              {t}
            </span>
          )
        }
        if (t === "true" || t === "false" || t === "null") {
          return (
            <span key={i} className="text-violet-700 dark:text-violet-300">
              {t}
            </span>
          )
        }
        if (/^-?\d/.test(t)) {
          return (
            <span key={i} className="text-emerald-700 dark:text-emerald-300">
              {t}
            </span>
          )
        }
        return <span key={i}>{t}</span>
      })}
    </>
  )
}

export function safeStringify(data: unknown): string {
  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}

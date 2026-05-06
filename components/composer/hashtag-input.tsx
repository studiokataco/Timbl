"use client"

import { useMemo, useState } from "react"
import { Copy } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

/*
 * Tag-chip input. Suggestions = union of category defaults + recently-used
 * tags from the posts collection. Enter / comma adds, Backspace on empty
 * input removes the last tag. Clicking a suggestion appends it.
 */
export function HashtagInput({
  value,
  onChange,
  suggestions,
  placeholder,
}: {
  value: string[]
  onChange: (next: string[]) => void
  suggestions: string[]
  placeholder?: string
}) {
  const [draft, setDraft] = useState("")

  const normalized = (raw: string) => {
    const trimmed = raw.trim().replace(/^#?/, "#")
    return trimmed.length > 1 ? trimmed : null
  }

  const add = (raw: string) => {
    const tag = normalized(raw)
    if (!tag) return
    if (value.includes(tag)) {
      setDraft("")
      return
    }
    onChange([...value, tag])
    setDraft("")
  }

  const remove = (tag: string) =>
    onChange(value.filter((v) => v !== tag))

  const filteredSuggestions = useMemo(() => {
    const used = new Set(value)
    const q = draft.trim().toLowerCase().replace(/^#/, "")
    return suggestions
      .filter((s) => !used.has(s))
      .filter((s) => (q ? s.toLowerCase().includes(q) : true))
      .slice(0, 8)
  }, [suggestions, value, draft])

  const copyHashtags = () => {
    const text = value.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")
    void navigator.clipboard.writeText(text)
    toast.success("Hashtags copied")
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5 rounded-md border border-input bg-background p-2 min-h-10">
        {value.map((h) => (
          <Badge
            key={h}
            variant="secondary"
            className="rounded-full pl-2 pr-1.5 gap-1 font-normal"
          >
            {h}
            <button
              type="button"
              onClick={() => remove(h)}
              aria-label={`Remove ${h}`}
              className="opacity-60 hover:opacity-100"
            >
              ×
            </button>
          </Badge>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault()
              add(draft)
            } else if (e.key === "Backspace" && !draft && value.length > 0) {
              remove(value[value.length - 1])
            }
          }}
          placeholder={value.length === 0 ? (placeholder ?? "#tag") : ""}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm"
        />
      </div>
      {value.length > 0 && (
        <button
          type="button"
          onClick={copyHashtags}
          className="self-start flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Copy aria-hidden className="size-3" />
          Copy hashtags
        </button>
      )}
      {filteredSuggestions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {filteredSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

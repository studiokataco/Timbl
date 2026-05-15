"use client"

import { useCallback, useEffect, useMemo, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Calendar, Loader2, Sparkles, X } from "lucide-react"
import { toast } from "sonner"

import type { IdeationItem } from "@/lib/schemas/ideationItem"
import {
  listIdeationFeed,
  markIdeationStatus,
  promoteIdeationItem,
} from "@/lib/actions/ideation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/*
 * Ideation triage — the inspector's focused single-item view.
 *
 * Replaces the Phase A read-only IdeationPanel stub. Owns its own list
 * query (seeded by props.initialItems) so it can compute prev/next for
 * J/K keyboard navigation without piping a callback through three
 * components. Promote / dismiss delegates to existing
 * `promoteIdeationItem` and `markIdeationStatus` server actions — no
 * signature changes.
 *
 * Keyboard:
 *   P → promote
 *   X or D → dismiss
 *   J → next pending
 *   K → previous pending
 *
 * The listener is scoped to mount of this component, which is itself
 * gated by `?focus=ideation:<id>` in the inspector — so the shortcuts
 * never fire elsewhere.
 */

type Props = {
  item: IdeationItem
  initialItems: IdeationItem[]
}

export function IdeationTriage({ item, initialItems }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const queryClient = useQueryClient()
  const [pending, startTransition] = useTransition()

  /* Live list of pending items for J/K navigation. Hydrated from the
   * server-rendered initial list so first paint is instant, then polled
   * cheaply on focus. */
  const { data: items = initialItems } = useQuery({
    queryKey: ["ideation", "new"],
    queryFn: () => listIdeationFeed({ status: "new" }),
    initialData: initialItems,
    staleTime: 10_000,
  })

  const idx = useMemo(
    () => items.findIndex((i) => i.id === item.id),
    [items, item.id],
  )
  const prev = idx > 0 ? items[idx - 1] : null
  const next = idx >= 0 && idx < items.length - 1 ? items[idx + 1] : null

  const focusItem = useCallback(
    (id: string | null) => {
      const sp = new URLSearchParams(params.toString())
      if (id) sp.set("focus", `ideation:${id}`)
      else sp.delete("focus")
      const qs = sp.toString()
      router.replace(qs ? `/studio?${qs}` : "/studio", { scroll: false })
    },
    [params, router],
  )

  const promote = useCallback(() => {
    startTransition(async () => {
      const res = await promoteIdeationItem({ itemId: item.id })
      if (!res.ok) {
        toast.error("Promote failed", { description: res.error })
        return
      }
      toast.success("Promoted to draft", {
        description: "Find it on the calendar and kanban.",
      })
      queryClient.invalidateQueries({ queryKey: ["ideation"] })
      queryClient.invalidateQueries({ queryKey: ["posts"] })
      queryClient.invalidateQueries({ queryKey: ["studio", "runs"] })
      // Advance to the next pending item, or clear focus if queue is drained.
      const remaining = items.filter((i) => i.id !== item.id)
      focusItem(remaining[idx] ? remaining[idx].id : null)
    })
  }, [item.id, items, idx, focusItem, queryClient])

  const dismiss = useCallback(() => {
    startTransition(async () => {
      const res = await markIdeationStatus({
        itemId: item.id,
        status: "dismissed",
      })
      if (!res.ok) {
        toast.error("Dismiss failed", { description: res.error })
        return
      }
      queryClient.invalidateQueries({ queryKey: ["ideation"] })
      const remaining = items.filter((i) => i.id !== item.id)
      focusItem(remaining[idx] ? remaining[idx].id : null)
    })
  }, [item.id, items, idx, focusItem, queryClient])

  /* Keyboard shortcuts, scoped to this component's mount. */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      switch (e.key.toLowerCase()) {
        case "p":
          e.preventDefault()
          promote()
          break
        case "x":
        case "d":
          e.preventDefault()
          dismiss()
          break
        case "j":
          if (next) {
            e.preventDefault()
            focusItem(next.id)
          }
          break
        case "k":
          if (prev) {
            e.preventDefault()
            focusItem(prev.id)
          }
          break
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [promote, dismiss, next, prev, focusItem])

  const confidencePct = Math.round(item.confidence * 100)

  return (
    <div className="h-full overflow-y-auto px-5 py-5">
      {/* Hero card */}
      <section className="rounded-lg border border-border bg-canvas p-5">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Idea {idx >= 0 ? `${idx + 1} of ${items.length}` : ""}
            </p>
            <h2 className="mt-1 text-display-sm text-foreground leading-tight">
              {item.title}
            </h2>
          </div>
          <ConfidenceRing pct={confidencePct} />
        </div>
        {item.summary && (
          <p className="mt-3 text-body-md text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {item.summary}
          </p>
        )}
      </section>

      {/* Suggested date strip */}
      {item.suggestedDate && (
        <section className="mt-4">
          <SectionLabel>Suggested date</SectionLabel>
          <DateStrip iso={item.suggestedDate} />
        </section>
      )}

      {/* Sources */}
      {item.sourceUrls.length > 0 && (
        <section className="mt-5">
          <SectionLabel>Sources ({item.sourceUrls.length})</SectionLabel>
          <ul className="mt-2 flex flex-col gap-1.5">
            {item.sourceUrls.map((url) => (
              <li key={url}>
                <SourceCard url={url} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Primary CTAs */}
      <div className="mt-6 flex items-center gap-2">
        <Button type="button" size="sm" onClick={promote} disabled={pending}>
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="size-3.5" aria-hidden />
          )}
          Promote to draft
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={dismiss}
          disabled={pending}
        >
          <X className="size-3.5" aria-hidden />
          Dismiss
        </Button>
        <span className="flex-1" />
        <KbdHint />
      </div>

      {/* End-of-queue hint */}
      {items.length === 1 && (
        <p className="mt-5 text-center text-[12px] text-muted-foreground">
          Last idea in the queue.
        </p>
      )}
    </div>
  )
}

/* ---------------- Empty-queue state ---------------- */

export function IdeationTriageEmpty() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6 py-10 gap-2">
      <p className="text-title-md text-foreground">Inbox zero</p>
      <p className="text-[13px] text-muted-foreground max-w-[34ch] leading-relaxed">
        No new ideas to triage.
      </p>
    </div>
  )
}

/* ---------------- Confidence ring ---------------- */

function ConfidenceRing({ pct }: { pct: number }) {
  const size = 64
  const stroke = 6
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-label={`Confidence ${pct} percent`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-border"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="text-foreground"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold tabular-nums text-foreground">
        {pct}%
      </span>
    </div>
  )
}

/* ---------------- Date strip ---------------- */

function DateStrip({ iso }: { iso: string }) {
  // iso is yyyy-mm-dd
  const [y, m, d] = iso.split("-").map((s) => parseInt(s, 10))
  const date = !isNaN(y) && !isNaN(m) && !isNaN(d) ? new Date(y, m - 1, d) : null
  if (!date || isNaN(date.getTime())) {
    return (
      <p className="mt-1 text-[12px] text-muted-foreground tabular-nums">
        {iso}
      </p>
    )
  }
  const dow = date.toLocaleDateString(undefined, { weekday: "short" })
  const mon = date.toLocaleDateString(undefined, { month: "short" })
  return (
    <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2">
      <Calendar className="size-3.5 text-muted-foreground" aria-hidden />
      <span className="text-[12px] tabular-nums text-foreground">
        {mon} {date.getDate()}
      </span>
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {dow}
      </span>
    </div>
  )
}

/* ---------------- Source card ---------------- */

function SourceCard({ url }: { url: string }) {
  const host = hostname(url)
  const fav = `https://www.google.com/s2/favicons?domain=${host}&sz=32`
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg border border-border bg-canvas px-3.5 py-3 hover:bg-secondary/40 transition-colors"
    >
      <span
        aria-hidden
        className="size-7 shrink-0 rounded-md bg-secondary flex items-center justify-center overflow-hidden"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fav}
          alt=""
          width={20}
          height={20}
          className="size-5"
          loading="lazy"
        />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-foreground truncate">
          {host}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">{url}</p>
      </div>
    </a>
  )
}

/* ---------------- helpers ---------------- */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  )
}

function KbdHint() {
  return (
    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
      <Kbd>P</Kbd> promote
      <Kbd>X</Kbd> dismiss
      <Kbd>J</Kbd>
      <Kbd>K</Kbd> nav
    </span>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center rounded border border-border bg-canvas",
        "min-w-[16px] h-[16px] px-1 text-[10px] font-mono text-muted-foreground",
      )}
    >
      {children}
    </kbd>
  )
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

"use client"

import { useTransition } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ExternalLink, Loader2, Sparkles, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  listIdeationFeed,
  markIdeationStatus,
  promoteIdeationItem,
} from "@/lib/actions/ideation"
import type { IdeationItem } from "@/lib/schemas/ideationItem"

export function IdeationClient({ initial }: { initial: IdeationItem[] }) {
  const queryClient = useQueryClient()
  const { data: items = initial } = useQuery({
    queryKey: ["ideation", "new"],
    queryFn: () => listIdeationFeed({ status: "new" }),
    initialData: initial,
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {items.map((item) => (
        <Card key={item.id} item={item} onChanged={() => {
          queryClient.invalidateQueries({ queryKey: ["ideation"] })
          queryClient.invalidateQueries({ queryKey: ["posts"] })
        }} />
      ))}
    </div>
  )
}

function Card({
  item,
  onChanged,
}: {
  item: IdeationItem
  onChanged: () => void
}) {
  const [pending, startTransition] = useTransition()

  function promote() {
    startTransition(async () => {
      const res = await promoteIdeationItem({ itemId: item.id })
      if (res.ok) {
        toast.success("Promoted to draft", {
          description: "Find it on the calendar and kanban.",
        })
        onChanged()
      } else {
        toast.error("Promote failed", { description: res.error })
      }
    })
  }

  function dismiss() {
    startTransition(async () => {
      const res = await markIdeationStatus({ itemId: item.id, status: "dismissed" })
      if (res.ok) onChanged()
      else toast.error("Dismiss failed", { description: res.error })
    })
  }

  return (
    <article className="rounded-xl border border-border bg-background p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-medium leading-snug">{item.title}</h2>
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {Math.round(item.confidence * 100)}%
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {item.summary}
      </p>
      {item.sourceUrls.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 text-[11px]">
          {item.sourceUrls.slice(0, 4).map((url) => (
            <li key={url}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              >
                {hostname(url)}
                <ExternalLink className="size-3" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      )}
      {item.suggestedDate && (
        <p className="text-[11px] text-muted-foreground">
          Suggested for {item.suggestedDate}
        </p>
      )}
      <div className="flex gap-1.5 pt-1">
        <Button size="sm" onClick={promote} disabled={pending}>
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="size-3.5" aria-hidden />
          )}
          Use
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={dismiss}
          disabled={pending}
        >
          <X className="size-3.5" aria-hidden />
          Dismiss
        </Button>
      </div>
    </article>
  )
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { CheckCircle2, Globe } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { promoteAwarenessDay } from "@/lib/actions/awareness"
import type { WithId } from "@/lib/firebase/serialize"
import type { AwarenessDay, Category } from "@/lib/schemas"

type Props = {
  days: WithId<AwarenessDay>[]
  plannedIds: Set<string>
  categories: WithId<Category>[]
}

const IMPORTANCE_VARIANT: Record<
  AwarenessDay["importance"],
  "default" | "secondary" | "outline"
> = {
  high: "default",
  medium: "secondary",
  low: "outline",
}

export function AwarenessList({ days, plannedIds, categories }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const categoryById = new Map(categories.map((c) => [c.id, c]))

  if (days.length === 0) {
    return (
      <EmptyState
        icon={Globe}
        title="No awareness days in the next 90 days"
        body="Curated dates rotate annually. Check back closer to international observance weeks, or add your own to the calendar with quick add."
        size="lg"
      />
    )
  }

  const promote = (day: WithId<AwarenessDay>) => {
    startTransition(async () => {
      const res = await promoteAwarenessDay({ awarenessDayId: day.id })
      if (!res.ok) {
        toast.error(res.error ?? "Could not create post")
        return
      }
      toast.success(`Post created for ${day.name}`)
      router.refresh()
    })
  }

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="p-2.5 text-left font-medium">Date</th>
            <th className="p-2.5 text-left font-medium">Awareness day</th>
            <th className="p-2.5 text-left font-medium">Importance</th>
            <th className="p-2.5 text-left font-medium">Suggested category</th>
            <th className="p-2.5 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d, i) => {
            const planned = plannedIds.has(d.id)
            const cat = d.suggestedCategorySlug
              ? categoryById.get(d.suggestedCategorySlug)
              : null
            return (
              <tr
                key={d.id}
                className={
                  i > 0
                    ? "border-t border-border hover:bg-secondary/20"
                    : "hover:bg-secondary/20"
                }
              >
                <td className="p-2.5 whitespace-nowrap text-xs text-muted-foreground">
                  {format(parseISO(d.date), "EEE d MMM yyyy")}
                </td>
                <td className="p-2.5">
                  <div className="font-medium">{d.name}</div>
                  {d.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {d.description}
                    </p>
                  )}
                </td>
                <td className="p-2.5">
                  <Badge
                    variant={IMPORTANCE_VARIANT[d.importance]}
                    className="capitalize font-normal text-xs"
                  >
                    {d.importance}
                  </Badge>
                </td>
                <td className="p-2.5 text-xs text-muted-foreground">
                  {cat ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="size-2 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      {cat.name}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-2.5 text-right">
                  {planned ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-signature-forest)]">
                      <CheckCircle2 aria-hidden className="size-3.5" />
                      Planned
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => promote(d)}
                      disabled={pending}
                    >
                      Promote to post
                    </Button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

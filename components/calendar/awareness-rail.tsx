"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { Lightbulb, Sparkles, TrendingDown } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { promoteAwarenessDay } from "@/lib/actions/awareness"
import type { WithId } from "@/lib/firebase/serialize"
import type { AwarenessDay } from "@/lib/schemas"
import type { Suggestion } from "@/lib/queries/suggestions.server"

type Props = {
  awarenessDays: WithId<AwarenessDay>[]
  plannedAwarenessIds: string[]
  suggestions: Suggestion[]
}

const IMPORTANCE_VARIANT: Record<
  AwarenessDay["importance"],
  "default" | "secondary" | "outline"
> = {
  high: "default",
  medium: "secondary",
  low: "outline",
}

/*
 * Right rail on the calendar surface. Two stacked panels:
 *   1. Awareness this period — upcoming awareness days within the visible
 *      calendar window. Promote-to-post inline.
 *   2. Suggestions — silent categories, cadence-due templates, campaigns
 *      ending soon. Computed server-side per render.
 */
export function CalendarAwarenessRail({
  awarenessDays,
  plannedAwarenessIds,
  suggestions,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const planned = new Set(plannedAwarenessIds)

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
    <>
      <section className="flex flex-col gap-3 border-t border-border py-6">
        <div className="flex items-center gap-1.5">
          <Sparkles aria-hidden className="size-3.5 text-muted-foreground" />
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Awareness this period
          </h2>
        </div>
        {awarenessDays.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            None in the visible window.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {awarenessDays.map((d) => {
              const isPlanned = planned.has(d.id)
              return (
                <li
                  key={d.id}
                  className="rounded-lg border border-border bg-background p-3 text-xs flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {format(parseISO(d.date), "EEE d MMM")}
                    </span>
                    <Badge
                      variant={IMPORTANCE_VARIANT[d.importance]}
                      className="capitalize font-normal text-[10px] px-1.5 py-0"
                    >
                      {d.importance}
                    </Badge>
                  </div>
                  <div className="font-medium leading-snug">{d.name}</div>
                  {isPlanned ? (
                    <span className="text-[var(--color-success)] text-[11px]">
                      ✓ planned
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs self-start"
                      onClick={() => promote(d)}
                      disabled={pending}
                    >
                      Promote to post
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-border py-6">
        <div className="flex items-center gap-1.5">
          <Lightbulb aria-hidden className="size-3.5 text-muted-foreground" />
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Suggestions
          </h2>
        </div>
        {suggestions.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            All caught up - no nudges right now.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {suggestions.map((s, i) => (
              <li
                key={`${s.kind}-${i}`}
                className="rounded-lg border border-border bg-background p-3 text-xs flex flex-col gap-1"
              >
                {s.kind === "silent-category" && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <TrendingDown
                        aria-hidden
                        className="size-3 text-muted-foreground"
                      />
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Silent category
                      </span>
                    </div>
                    <div className="font-medium leading-snug">{s.name}</div>
                    <div className="text-muted-foreground">
                      No post in {s.daysSilent}+ days
                    </div>
                  </>
                )}
                {s.kind === "template-due" && (
                  <>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Template due ({s.cadence})
                    </span>
                    <div className="font-medium leading-snug">{s.name}</div>
                    <div className="text-muted-foreground">
                      Last used {s.daysSinceLast} days ago
                    </div>
                  </>
                )}
                {s.kind === "campaign-ending" && (
                  <>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Campaign ending
                    </span>
                    <div className="font-medium leading-snug">{s.name}</div>
                    <div className="text-muted-foreground">
                      Ends {format(parseISO(s.endDate), "d MMM")} (
                      {s.daysAway} {s.daysAway === 1 ? "day" : "days"})
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

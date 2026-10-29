"use client"

import { useId, useTransition } from "react"
import { useRouter } from "next/navigation"
import { differenceInCalendarDays, format, parseISO } from "date-fns"
import { Bell, Check, Sparkles, TrendingDown } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DisclosureBody, DisclosureTrigger, useRemembered } from "@/components/ui/disclosure"
import { promoteAwarenessDay } from "@/lib/actions/awareness"
import type { WithId } from "@/lib/firebase/serialize"
import type { AwarenessDay } from "@/lib/schemas"
import { CADENCE_LABELS, IMPORTANCE_LABELS, labelOr } from "@/lib/labels/enums"
import type { Suggestion } from "@/lib/queries/suggestions.server"
import { AnimatePresence, motion } from "framer-motion"
import { StackedDeck } from "./stacked-deck"

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

const KIND_LABEL: Record<string, string> = {
  "silent-category": "Silent category",
  "template-due": "Template due",
  "campaign-ending": "Campaign ending",
}

function suggestionMetric(s: Suggestion): string {
  if (s.kind === "silent-category") return s.neverUsed ? "new" : `${s.daysSilent}d silent`
  if (s.kind === "template-due") return labelOr(CADENCE_LABELS, s.cadence)
  if (s.kind === "campaign-ending") return `${s.daysAway}d left`
  return ""
}

function suggestionSummary(s: Suggestion): string {
  if (s.kind === "silent-category") return `${s.name}, ${s.neverUsed ? "not posted yet" : `${s.daysSilent}d silent`}`
  if (s.kind === "template-due") return `${s.name} due`
  if (s.kind === "campaign-ending") return `${s.name} ends in ${s.daysAway} ${s.daysAway === 1 ? "day" : "days"}`
  return ""
}

function relativeDay(days: number): string {
  if (days === 0) return "today"
  if (days === 1) return "tomorrow"
  if (days < 0) return `${-days} ${days === -1 ? "day" : "days"} ago`
  return `in ${days} days`
}

export function CalendarAwarenessRail({
  awarenessDays,
  plannedAwarenessIds,
  suggestions,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [awarenessOpen, setAwarenessOpen] = useRemembered("calendar.awareness", true)
  const [remindersOpen, setRemindersOpen] = useRemembered("calendar.reminders", true)
  const remindersId = useId()
  const awarenessId = useId()
  const planned = new Set(plannedAwarenessIds)

  const promote = (day: WithId<AwarenessDay>) => {
    startTransition(async () => {
      const res = await promoteAwarenessDay({ awarenessDayId: day.id })
      if (!res.ok) {
        toast.error(res.error ?? "Could not create post")
        return
      }
      toast.success(`Post created for ${day.name}`, {
        description: "Saved to All posts as a draft.",
        action: {
          label: "Open",
          onClick: () => router.push("/posts?status=draft"),
        },
      })
      router.refresh()
    })
  }

  const FAN_MAX = 3

  const sortedAwarenessDays = [...awarenessDays].sort((a, b) => {
    const aPlanned = planned.has(a.id) ? 1 : 0
    const bPlanned = planned.has(b.id) ? 1 : 0
    return aPlanned - bPlanned
  })

  const awarenessCards: React.ReactNode[] = sortedAwarenessDays
    .slice(0, FAN_MAX)
    .map((d) => (
      <div key={d.id} className="rounded-lg border border-border bg-background p-3 text-xs flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {format(parseISO(d.date), "EEE d MMM")}
          </span>
          <Badge
            variant={IMPORTANCE_VARIANT[d.importance]}
            className="font-normal text-[10px] px-1.5 py-0"
          >
            {IMPORTANCE_LABELS[d.importance]}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="font-medium leading-snug">{d.name}</div>
          {planned.has(d.id) && (
            <Check className="size-3 shrink-0 text-[var(--color-success)]" />
          )}
        </div>
      </div>
    ))

  const awarenessRemainder = awarenessDays.length - FAN_MAX
  if (awarenessRemainder > 0) {
    awarenessCards.push(
      <div key="more" className="rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground flex items-center justify-center h-full">
        + {awarenessRemainder} more
      </div>
    )
  }

  const byDate = [...awarenessDays].sort((a, b) => a.date.localeCompare(b.date))
  const nextDay = byDate.find((d) => differenceInCalendarDays(parseISO(d.date), new Date()) >= 0) ?? byDate[0]
  const awarenessSummary = nextDay
    ? `${nextDay.name} ${relativeDay(differenceInCalendarDays(parseISO(nextDay.date), new Date()))}`
    : null
  const remindersSummary = suggestions[0] ? suggestionSummary(suggestions[0]) : null

  const suggestionCards: React.ReactNode[] = suggestions
    .slice(0, FAN_MAX)
    .map((s, i) => (
      <div key={i} className="rounded-lg border border-border bg-background p-3 text-xs flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {KIND_LABEL[s.kind] ?? s.kind}
          </span>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {suggestionMetric(s)}
          </span>
        </div>
        <div className="font-medium leading-snug">{s.name}</div>
      </div>
    ))

  const suggestionsRemainder = suggestions.length - FAN_MAX
  if (suggestionsRemainder > 0) {
    suggestionCards.push(
      <div key="more" className="rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground flex items-center justify-center h-full">
        + {suggestionsRemainder} more
      </div>
    )
  }

  return (
    <>
      <section className="flex flex-col gap-3 border-t border-border py-6">
        <DisclosureTrigger
          heading={2}
          open={remindersOpen}
          onOpenChange={setRemindersOpen}
          controls={remindersId}
          chevronClassName="size-3.5"
          className="gap-1.5 rounded-sm"
        >
          <Bell aria-hidden className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Reminders
          </span>
          {suggestions.length > 0 && (
            <Badge
              variant="secondary"
              className="font-normal text-[10px] px-1.5 py-0"
            >
              {suggestions.length}
            </Badge>
          )}
          {!remindersOpen && remindersSummary && (
            <span className="min-w-0 truncate text-[11px] text-muted-foreground">
              {remindersSummary}
            </span>
          )}
        </DisclosureTrigger>

        <DisclosureBody id={remindersId} open={remindersOpen}>
          {suggestions.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              All caught up - no reminders right now.
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
                        {s.neverUsed
                          ? "Not posted yet"
                          : `No post in ${s.daysSilent}+ days`}
                      </div>
                    </>
                  )}
                  {s.kind === "template-due" && (
                    <>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Template due ({labelOr(CADENCE_LABELS, s.cadence)})
                      </span>
                      <div className="font-medium leading-snug">{s.name}</div>
                      <div className="text-muted-foreground">
                        {s.neverUsed
                          ? "Not used yet"
                          : `Last used ${s.daysSinceLast} days ago`}
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
        </DisclosureBody>

        {!remindersOpen && suggestions.length > 0 && (
          <StackedDeck
            cards={suggestionCards}
            slotHeight={60}
            onClick={() => setRemindersOpen(true)}
          />
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-border py-6">
        <DisclosureTrigger
          heading={2}
          open={awarenessOpen}
          onOpenChange={setAwarenessOpen}
          controls={awarenessId}
          chevronClassName="size-3.5"
          className="gap-1.5 rounded-sm"
        >
          <Sparkles aria-hidden className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Awareness this period
          </span>
          {awarenessDays.length > 0 && (
            <Badge
              variant="secondary"
              className="font-normal text-[10px] px-1.5 py-0"
            >
              {awarenessDays.length}
            </Badge>
          )}
          {!awarenessOpen && awarenessSummary && (
            <span className="min-w-0 truncate text-[11px] text-muted-foreground">
              {awarenessSummary}
            </span>
          )}
        </DisclosureTrigger>

        <DisclosureBody id={awarenessId} open={awarenessOpen}>
          {awarenessDays.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              None in the visible window.
            </p>
          ) : (
            <motion.ul layout className="flex flex-col gap-1.5">
              <AnimatePresence initial={false}>
                {sortedAwarenessDays.map((d) => {
                  const isPlanned = planned.has(d.id)
                  return (
                    <motion.li
                      key={d.id}
                      layout
                      transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
                      className="rounded-lg border border-border bg-background p-3 text-xs flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {format(parseISO(d.date), "EEE d MMM")}
                        </span>
                        <Badge
                          variant={IMPORTANCE_VARIANT[d.importance]}
                          className="font-normal text-[10px] px-1.5 py-0"
                        >
                          {IMPORTANCE_LABELS[d.importance]}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium leading-snug">{d.name}</div>
                        {isPlanned && (
                          <Check className="size-3 shrink-0 text-[var(--color-success)]" />
                        )}
                      </div>
                      {!isPlanned && (
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
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </motion.ul>
          )}
        </DisclosureBody>

        {!awarenessOpen && awarenessDays.length > 0 && (
          <StackedDeck
            cards={awarenessCards}
            slotHeight={72}
            onClick={() => setAwarenessOpen(true)}
          />
        )}
      </section>
    </>
  )
}

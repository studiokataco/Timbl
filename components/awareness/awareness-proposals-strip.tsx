"use client"

import { useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import { differenceInCalendarDays, format, parseISO } from "date-fns"
import { Check, ChevronDown, ExternalLink, Sparkles, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  acceptProposal,
  rejectProposal,
  type AwarenessProposal,
} from "@/lib/actions/awareness-proposals"
import type { WithId } from "@/lib/firebase/serialize"
import { IMPORTANCE_LABELS } from "@/lib/labels/enums"
import type { AwarenessImportance } from "@/lib/schemas/awarenessDay"

/*
 * Pending awareness-day proposals. Rendered above the canonical
 * awareness list, soonest first. Each card leads with the date, then the
 * day, its sources, and Accept / Reject. Accept asks for a priority and
 * copies into the official awarenessDays collection; Reject is
 * sticky-soft (audit trail).
 */

const PRIORITIES: AwarenessImportance[] = ["high", "medium", "low"]

export function AwarenessProposalsStrip({
  proposals,
}: {
  proposals: WithId<AwarenessProposal>[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const sorted = useMemo(
    () => proposals.slice().sort((a, b) => a.date.localeCompare(b.date)),
    [proposals],
  )

  if (proposals.length === 0) return null

  const handle = (
    action: "accept" | "reject",
    proposal: WithId<AwarenessProposal>,
    importance?: AwarenessImportance,
  ) => {
    startTransition(async () => {
      const res =
        action === "accept"
          ? await acceptProposal({ id: proposal.id, importance })
          : await rejectProposal({ id: proposal.id })
      if (!res.ok) {
        toast.error(res.error ?? "Action failed")
        return
      }
      toast.success(
        action === "accept"
          ? `Added “${proposal.name}” to awareness days`
          : `Rejected “${proposal.name}”`,
      )
      router.refresh()
    })
  }

  return (
    <section
      id="awareness-proposals"
      aria-label="Proposed awareness days"
      className="rounded-lg border border-border bg-secondary/20 p-4 sm:p-5 space-y-3"
    >
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Sparkles aria-hidden className="size-4 text-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            {proposals.length} proposed awareness {proposals.length === 1 ? "day" : "days"}
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Found by the awareness-researcher. Set a priority as you accept to add it to your calendar, or reject to dismiss.
        </p>
      </header>

      <ul className="space-y-2.5">
        {sorted.map((p) => (
          <li
            key={p.id}
            className="rounded-lg border border-border bg-background p-3 sm:p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 flex-1 gap-3 sm:gap-4">
                <DateTile iso={p.date} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {p.name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground" suppressHydrationWarning>
                    {format(parseISO(p.date), "EEEE")} · {relativeDay(p.date)}
                  </p>
                  {p.description && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {p.description}
                    </p>
                  )}
                  {p.sourceUrls && p.sourceUrls.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                      {p.sourceUrls.slice(0, 3).map((url) => (
                        <li key={url}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                          >
                            <ExternalLink aria-hidden className="size-3" />
                            {hostname(url)}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="flex w-full gap-2 sm:w-auto sm:shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handle("reject", p)}
                  disabled={pending}
                  aria-label={`Reject ${p.name}`}
                  className="flex-1 sm:flex-none"
                >
                  <X aria-hidden className="size-3.5" /> Reject
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    disabled={pending}
                    render={
                      <Button
                        size="sm"
                        aria-label={`Accept ${p.name}`}
                        className="flex-1 sm:flex-none"
                      />
                    }
                  >
                    <Check aria-hidden className="size-3.5" /> Accept
                    <ChevronDown aria-hidden className="size-3.5 opacity-60" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-36">
                    <DropdownMenuLabel>Set priority</DropdownMenuLabel>
                    {PRIORITIES.map((level) => (
                      <DropdownMenuItem
                        key={level}
                        onClick={() => handle("accept", p, level)}
                      >
                        {IMPORTANCE_LABELS[level]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function DateTile({ iso }: { iso: string }) {
  const date = parseISO(iso)
  return (
    <div className="flex w-12 shrink-0 flex-col items-center rounded-md border border-border py-1.5">
      <span className="sr-only">{format(date, "d MMMM yyyy")}</span>
      <span aria-hidden className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {format(date, "MMM")}
      </span>
      <span aria-hidden className="text-lg font-semibold leading-tight tabular-nums text-foreground">
        {format(date, "d")}
      </span>
    </div>
  )
}

function relativeDay(iso: string): string {
  const days = differenceInCalendarDays(parseISO(iso), new Date())
  if (days === 0) return "today"
  if (days === 1) return "tomorrow"
  if (days === -1) return "yesterday"
  return days > 0 ? `in ${days} days` : `${-days} days ago`
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

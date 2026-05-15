"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { Check, ExternalLink, Sparkles, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  acceptProposal,
  rejectProposal,
  type AwarenessProposal,
} from "@/lib/actions/awareness-proposals"
import type { WithId } from "@/lib/firebase/serialize"

/*
 * Pending awareness-day proposals. Rendered above the canonical
 * awareness list. Each card shows the proposed day, its source URLs,
 * and inline Accept / Reject actions. Accept copies into the official
 * awarenessDays collection; Reject is sticky-soft (audit trail).
 */

export function AwarenessProposalsStrip({
  proposals,
}: {
  proposals: WithId<AwarenessProposal>[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  if (proposals.length === 0) return null

  const handle = (
    action: "accept" | "reject",
    proposal: WithId<AwarenessProposal>,
  ) => {
    startTransition(async () => {
      const res =
        action === "accept"
          ? await acceptProposal({ id: proposal.id })
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
      aria-label="Proposed awareness days"
      className="rounded-lg border border-border bg-secondary/20 p-4 sm:p-5 space-y-3"
    >
      <header className="flex items-center gap-2">
        <Sparkles aria-hidden className="size-4 text-foreground" />
        <h2 className="text-sm font-semibold text-foreground">
          {proposals.length} proposed awareness {proposals.length === 1 ? "day" : "days"}
        </h2>
        <p className="text-xs text-muted-foreground">
          From the awareness-researcher — accept to add to your calendar, or reject to dismiss.
        </p>
      </header>

      <ul className="space-y-2.5">
        {proposals.map((p) => (
          <li
            key={p.id}
            className="rounded-lg border border-border bg-background p-3 sm:p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-badge-orange text-foreground border-transparent font-normal text-[11px]">
                    Proposed
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(parseISO(p.date), "EEE d MMM yyyy")}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize">
                    · {p.importance}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-medium text-foreground">
                  {p.name}
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
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handle("reject", p)}
                  disabled={pending}
                  aria-label={`Reject ${p.name}`}
                >
                  <X aria-hidden className="size-3.5" /> Reject
                </Button>
                <Button
                  size="sm"
                  onClick={() => handle("accept", p)}
                  disabled={pending}
                  aria-label={`Accept ${p.name}`}
                >
                  <Check aria-hidden className="size-3.5" /> Accept
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

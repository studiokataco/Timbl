"use client"

import { useState } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { ChevronDown, Megaphone } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { CAMPAIGN_STATUS_LABELS, labelOr } from "@/lib/labels/enums"
import type { WithId } from "@/lib/firebase/serialize"
import type { Campaign } from "@/lib/schemas"
import { StackedDeck } from "./stacked-deck"

export type CampaignRow = WithId<Campaign> & {
  postCount: number
  scheduledOrPosted: number
}

type Props = { campaigns: CampaignRow[] }

const FAN_MAX = 3

export function CampaignTracker({ campaigns }: Props) {
  const [open, setOpen] = useState(false)

  const active = campaigns
    .filter((c) => c.status === "active")
    .sort((a, b) => {
      if (!a.endDate) return b.endDate ? 1 : 0
      if (!b.endDate) return -1
      return a.endDate.localeCompare(b.endDate)
    })

  const fanCards: React.ReactNode[] = active.slice(0, FAN_MAX).map((c) => {
    const pct =
      c.postCount > 0
        ? Math.round((c.scheduledOrPosted / c.postCount) * 100)
        : 0
    return (
      <div key={c.id} className="rounded-lg border border-border bg-background p-3 text-xs flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-2.5 rounded-full shrink-0"
            style={{ backgroundColor: c.color ?? "var(--color-muted-foreground)" }}
          />
          <span className="font-medium leading-snug truncate flex-1 min-w-0">
            {c.name}
          </span>
          <Badge variant="secondary" className="font-normal text-[10px] px-1.5 py-0">
            {labelOr(CAMPAIGN_STATUS_LABELS, c.status)}
          </Badge>
        </div>
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              backgroundColor: c.color ?? "var(--color-foreground)",
            }}
          />
        </div>
        <div className="flex items-center justify-between text-muted-foreground">
          <span>{c.scheduledOrPosted}/{c.postCount} ready</span>
          {c.endDate && <span>Ends {format(parseISO(c.endDate), "d MMM")}</span>}
        </div>
      </div>
    )
  })

  const remainder = active.length - FAN_MAX
  if (remainder > 0) {
    fanCards.push(
      <div key="more" className="rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground flex items-center justify-center h-full">
        + {remainder} more
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-3 border-t border-border py-6">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <Megaphone aria-hidden className="size-3.5 text-muted-foreground" />
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Campaigns
        </h2>
        {active.length > 0 && (
          <Badge variant="secondary" className="font-normal text-[10px] px-1.5 py-0">
            {active.length}
          </Badge>
        )}
        <ChevronDown
          aria-hidden
          className={`ml-auto size-3.5 text-muted-foreground transition-transform ${
            open ? "" : "rotate-180"
          }`}
        />
      </button>

      {open ? (
        active.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active campaigns.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {active.map((c) => {
              const pct =
                c.postCount > 0
                  ? Math.round((c.scheduledOrPosted / c.postCount) * 100)
                  : 0
              return (
                <li key={c.id}>
                  <Link
                    href={`/campaigns/${c.slug ?? c.id}`}
                    className="rounded-lg border border-border bg-background p-3 text-xs flex flex-col gap-2 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="size-2.5 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            c.color ?? "var(--color-muted-foreground)",
                        }}
                      />
                      <span className="font-medium leading-snug truncate flex-1 min-w-0">
                        {c.name}
                      </span>
                      <Badge
                        variant="secondary"
                        className="font-normal text-[10px] px-1.5 py-0"
                      >
                        {labelOr(CAMPAIGN_STATUS_LABELS, c.status)}
                      </Badge>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: c.color ?? "var(--color-foreground)",
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>
                        {c.scheduledOrPosted}/{c.postCount} ready
                      </span>
                      {c.endDate && (
                        <span>Ends {format(parseISO(c.endDate), "d MMM")}</span>
                      )}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )
      ) : active.length > 0 ? (
        <StackedDeck
          cards={fanCards}
          slotHeight={82}
          onClick={() => setOpen(true)}
        />
      ) : null}

      <Link
        href="/campaigns"
        className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
      >
        Manage campaigns
      </Link>
    </section>
  )
}

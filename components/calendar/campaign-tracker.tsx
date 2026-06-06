"use client"

import Link from "next/link"
import { format, parseISO } from "date-fns"
import { Megaphone } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { CAMPAIGN_STATUS_LABELS, labelOr } from "@/lib/labels/enums"
import type { WithId } from "@/lib/firebase/serialize"
import type { Campaign } from "@/lib/schemas"

export type CampaignRow = WithId<Campaign> & {
  postCount: number
  scheduledOrPosted: number
}

type Props = { campaigns: CampaignRow[] }

const MAX_ROWS = 4

/*
 * Right-rail tracker - a high-level read on active campaigns without leaving
 * the calendar. Active only, soonest-ending first; full control lives on
 * /campaigns via the Manage link. Mirrors the awareness-rail panel styling.
 */
export function CampaignTracker({ campaigns }: Props) {
  const active = campaigns
    .filter((c) => c.status === "active")
    .sort((a, b) => {
      if (!a.endDate) return b.endDate ? 1 : 0
      if (!b.endDate) return -1
      return a.endDate.localeCompare(b.endDate)
    })
  const rows = active.slice(0, MAX_ROWS)

  return (
    <section className="flex flex-col gap-3 border-t border-border py-6">
      <div className="flex items-center gap-1.5">
        <Megaphone aria-hidden className="size-3.5 text-muted-foreground" />
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Campaigns
        </h2>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No active campaigns.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((c) => {
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
      )}

      <Link
        href="/campaigns"
        className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
      >
        Manage campaigns
      </Link>
    </section>
  )
}

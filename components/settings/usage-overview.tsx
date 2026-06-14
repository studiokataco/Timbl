"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import { ArrowRight, TriangleAlert } from "lucide-react"

import { getUsageOverview, type OrgUsage } from "@/lib/actions/usage"
import { UsageMeter, usageMeterTone } from "@/components/settings/usage-meter"
import { cn } from "@/lib/utils"

function periodLabel(period: string): string {
  try {
    return format(parseISO(`${period}-01`), "MMMM yyyy")
  } catch {
    return period
  }
}

export function UsageOverview({ initial }: { initial: OrgUsage }) {
  const { data } = useQuery({
    queryKey: ["settings", "usage"],
    queryFn: () => getUsageOverview(),
    initialData: initial,
    refetchInterval: 30_000,
  })

  const tones = data.metrics.map((m) => usageMeterTone(m.used, m.limit))
  const over = tones.includes("over")
  const near = !over && tones.includes("near")

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Current period</p>
            <p className="text-lg font-medium">{periodLabel(data.period)}</p>
          </div>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
            {data.planLabel} plan
          </span>
        </div>
        <div className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          {data.metrics.map((m) => (
            <UsageMeter
              key={m.key}
              label={m.label}
              used={m.used}
              limit={m.limit}
              hint={m.resets ? `${m.hint}. Resets monthly.` : m.hint}
            />
          ))}
        </div>
      </div>

      {over || near ? (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 ring-1 ring-foreground/10",
            over ? "bg-destructive/10" : "bg-warning/10",
          )}
        >
          <div className="flex items-start gap-2.5">
            <TriangleAlert
              aria-hidden
              className={cn(
                "mt-0.5 size-4 shrink-0",
                over ? "text-destructive" : "text-warning",
              )}
            />
            <div>
              <p className="text-sm font-medium">
                {over
                  ? "You have reached a plan limit"
                  : "You are close to a plan limit"}
              </p>
              <p className="text-xs text-muted-foreground">
                {over
                  ? "Actions over the limit are paused until next month. A higher plan lifts it right away."
                  : "A higher plan gives this workspace more headroom before anything is paused."}
              </p>
            </div>
          </div>
          <Link
            href="/settings/billing"
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            Review plans
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Counters update as work happens and are approximate within a few
        seconds. Monthly metrics reset on the first of each month (UTC).
      </p>
    </div>
  )
}

"use client"

import { useQuery } from "@tanstack/react-query"
import { addMonths, format, isValid } from "date-fns"
import { useReducedMotion } from "framer-motion"
import { ArrowRight, TriangleAlert } from "lucide-react"

import { FormGroupTitle } from "@/components/shared/form-row"
import { StatGrid } from "@/components/shared/stat-grid"
import { COMPARE_PLANS } from "@/components/settings/billing-manager"
import { UsageMeter, usageMeterTone } from "@/components/settings/usage-meter"
import { useRemembered } from "@/components/ui/disclosure"
import { Button } from "@/components/ui/button"
import { getUsageOverview, type OrgUsage, type UsageMetricKey } from "@/lib/actions/usage"
import { cn } from "@/lib/utils"

const LABELS: Record<UsageMetricKey, { tile: string; inline: string }> = {
  agentRuns: { tile: "Agent runs", inline: "agent runs" },
  scheduledPosts: { tile: "Scheduled posts", inline: "scheduled posts" },
  channels: { tile: "Accounts", inline: "connected accounts" },
  seats: { tile: "Seats", inline: "seats" },
  agents: { tile: "Agents on", inline: "active agents" },
}

const list = new Intl.ListFormat("en-GB", { style: "long", type: "conjunction" })

function periodDates(period: string): { month: string; resets: string } | null {
  const [year, month] = period.split("-").map(Number)
  const start = new Date(year, month - 1, 1)
  if (!isValid(start)) return null
  return { month: format(start, "MMMM yyyy"), resets: format(addMonths(start, 1), "d MMM") }
}

function tileSpan(i: number, n: number): string {
  const rem = n % 3
  const wide =
    rem === 0 || i < n - rem ? "@xl:col-span-2" : rem === 2 ? "@xl:col-span-3" : "@xl:col-span-6"
  return cn(
    n % 2 === 1 && i === n - 1 ? "col-span-2" : "col-span-1",
    wide,
    n === 5 && "@4xl:col-span-1",
  )
}

export function UsageOverview({ initial, canCompare }: { initial: OrgUsage; canCompare: boolean }) {
  const reduced = useReducedMotion()
  const [, setPlansOpen] = useRemembered(COMPARE_PLANS.key, false)
  const { data } = useQuery({
    queryKey: ["settings", "usage"],
    queryFn: () => getUsageOverview(),
    initialData: initial,
    refetchInterval: 30_000,
  })

  const dates = periodDates(data.period)
  const resetsMonthly = data.metrics.some((m) => m.resets)
  const n = data.metrics.length
  const toned = data.metrics.map((m) => ({ m, tone: usageMeterTone(m.used, m.limit) }))
  const over = toned.filter((t) => t.tone === "over")
  const flagged = over.length > 0 ? over : toned.filter((t) => t.tone === "near")
  const flaggedNames = list.format(flagged.map(({ m }) => LABELS[m.key]?.inline ?? m.label.toLowerCase()))
  const flaggedTitle = `${flaggedNames.charAt(0).toUpperCase()}${flaggedNames.slice(1)} ${over.length > 0 ? "at the plan limit" : "close to the plan limit"}`

  const comparePlans = () => {
    setPlansOpen(true)
    requestAnimationFrame(() =>
      document
        .getElementById(COMPARE_PLANS.anchor)
        ?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }),
    )
  }

  return (
    <section aria-label="Usage" className="@container">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <FormGroupTitle className="pt-0">Usage</FormGroupTitle>
        {dates ? (
          <p className="text-[13px] text-muted-foreground">
            {dates.month}
            {resetsMonthly ? <> · Resets {dates.resets}</> : null}
          </p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <StatGrid className={cn("lg:grid-cols-2 @xl:grid-cols-6", n === 5 && "@4xl:grid-cols-5")}>
          {data.metrics.map((m, i) => (
            <UsageMeter
              key={m.key}
              className={tileSpan(i, n)}
              label={LABELS[m.key]?.tile ?? m.label}
              used={m.used}
              limit={m.limit}
            />
          ))}
        </StatGrid>

        {flagged.length > 0 ? (
          <div
            className={cn(
              "flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
              over.length > 0 ? "bg-destructive/5" : "bg-warning/5",
            )}
          >
            <div className="flex min-w-0 items-start gap-2.5">
              <TriangleAlert
                aria-hidden
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  over.length > 0 ? "text-destructive" : "text-warning",
                )}
              />
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-foreground">{flaggedTitle}</p>
                <p className="text-[13px] text-muted-foreground">
                  {over.length > 0
                    ? `Anything past the limit waits until it frees up or resets.${canCompare ? " A higher plan lifts it right away." : ""}`
                    : canCompare
                      ? "A higher plan adds headroom before anything has to wait."
                      : "Anything past the limit waits until it frees up or resets."}
                </p>
              </div>
            </div>
            {canCompare ? (
              <Button
                variant="outline"
                size="lg"
                className="shrink-0 self-start px-3 sm:self-center"
                onClick={comparePlans}
              >
                Compare plans
                <ArrowRight aria-hidden data-icon="inline-end" />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="mt-3 text-[12px] text-muted-foreground">
        Agent runs include failed runs. Runs and scheduled posts reset each month; accounts, seats and
        agents count what is in use right now.
      </p>
    </section>
  )
}

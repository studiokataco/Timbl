import { Panel } from "@/components/control/widgets"
import { compact } from "@/lib/platform/format"
import type { PeriodRow, UsageMetric } from "@/lib/platform/tenant-detail"
import { cn } from "@/lib/utils"

const METRIC_LABEL: Record<string, string> = {
  agentRuns: "Agent runs",
  scheduledPosts: "Scheduled posts",
  brands: "Brands",
  seats: "Seats",
}

export function TenantUsage({
  usage,
  periods,
}: {
  usage: UsageMetric[]
  periods: PeriodRow[]
}) {
  return (
    <Panel title="Usage vs quota" sub="this month">
      <div className="flex flex-col gap-3">
        {usage.map((u) => {
          const unlimited = u.limit === null
          const ratio = unlimited ? 0 : Math.min(1, u.used / Math.max(1, u.limit ?? 1))
          const over = !unlimited && u.used > (u.limit ?? 0)
          return (
            <div key={u.metric} className="text-sm">
              <div className={cn("flex items-baseline justify-between gap-2", !unlimited && "mb-1")}>
                <span className="font-medium">{METRIC_LABEL[u.metric] ?? u.metric}</span>
                <span className={cn("tabular-nums text-muted-foreground", over && "text-red-600 dark:text-red-400")}>
                  {unlimited ? (
                    <>
                      {compact(u.used)} <span className="font-medium text-emerald-600 dark:text-emerald-400">unlimited</span>
                    </>
                  ) : (
                    `${compact(u.used)} / ${compact(u.limit ?? 0)}`
                  )}
                </span>
              </div>
              {unlimited ? null : (
                <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      over ? "bg-red-500" : ratio > 0.8 ? "bg-amber-500" : "bg-foreground/70",
                    )}
                    style={{ width: `${Math.max(2, ratio * 100)}%` }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {periods.length > 0 ? (
        <div className="mt-5 border-t border-foreground/5 pt-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Recent months</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 font-medium">Month</th>
                <th className="py-1 text-right font-medium">Runs</th>
                <th className="py-1 text-right font-medium">Failed</th>
                <th className="py-1 text-right font-medium">Spend</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.period} className="border-t border-foreground/5">
                  <td className="py-1.5 tabular-nums">{p.period}</td>
                  <td className="py-1.5 text-right tabular-nums">{compact(p.agentRuns)}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">{compact(p.failed)}</td>
                  <td className="py-1.5 text-right tabular-nums">${p.usdCost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Panel>
  )
}

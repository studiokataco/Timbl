import { pct } from "@/lib/platform/format"
import type { CohortRow } from "@/lib/platform/retention"

/* Cohort retention triangle. Rows are signup-month cohorts (oldest first),
 * columns are months-since-signup. Cell intensity tracks the retained share.
 * Server-safe - pure presentation, no client state. */

function cellBackground(value: number): string {
  return `color-mix(in oklab, var(--color-chart-4) ${Math.round(value * 100)}%, transparent)`
}

const LEGEND_STOPS = [0.1, 0.35, 0.6, 0.85, 1]

export function CohortHeatmap({
  cohorts,
  maxCol,
}: {
  cohorts: CohortRow[]
  maxCol: number
}) {
  if (cohorts.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No cohort data yet - needs orgs with a signup date and recorded runs.
      </p>
    )
  }
  const cols = Array.from({ length: maxCol }, (_, i) => i)
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1 text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="px-2 py-1 text-left font-medium">Cohort</th>
              <th className="px-2 py-1 text-right font-medium">Orgs</th>
              {cols.map((k) => (
                <th
                  key={k}
                  className="px-2 py-1 text-center font-medium tabular-nums"
                  title={`${k} months after signup`}
                >
                  M{k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohorts.map((row) => (
              <tr key={row.cohort}>
                <td className="whitespace-nowrap px-2 py-1.5 font-medium tabular-nums">
                  {row.cohort}
                </td>
                <td className="px-2 py-1.5 text-right text-muted-foreground tabular-nums">
                  {row.size}
                </td>
                {cols.map((k) => {
                  const v = row.retention[k]
                  if (v === undefined) {
                    return <td key={k} className="px-2 py-1.5" />
                  }
                  return (
                    <td
                      key={k}
                      className="rounded-md px-2 py-1.5 text-center font-medium tabular-nums"
                      style={{
                        background: cellBackground(v),
                        color:
                          v > 0.55
                            ? "var(--color-background)"
                            : "var(--color-foreground)",
                      }}
                    >
                      {pct(v)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Less</span>
        <div className="flex gap-1">
          {LEGEND_STOPS.map((v) => (
            <span
              key={v}
              className="size-3.5 rounded-sm ring-1 ring-foreground/10"
              style={{ background: cellBackground(v) }}
            />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  )
}

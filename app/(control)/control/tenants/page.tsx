import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { PageHeading, StatusPill } from "@/components/control/widgets"
import { compact, pct, relativeTime, usd } from "@/lib/platform/format"
import { listOrgRows } from "@/lib/platform/queries"
import { tenantFinancials } from "@/lib/platform/revenue"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

const TIER_TONE: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  studio: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  agency: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  scale: "bg-amber-500/15 text-amber-700 dark:text-amber-500",
}

const TIER_ORDER = ["free", "studio", "agency", "scale"]

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string }>
}) {
  const { tier: activeTier } = await searchParams
  const allRows = await listOrgRows()

  const enriched = allRows.map((row) => ({
    row,
    fin: tenantFinancials(row.plan, row.mtdUsdCost),
  }))

  const tierCounts = new Map<string, number>()
  for (const e of enriched) tierCounts.set(e.fin.tier, (tierCounts.get(e.fin.tier) ?? 0) + 1)

  const visible = activeTier
    ? enriched.filter((e) => e.fin.tier === activeTier)
    : enriched

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <PageHeading
          title="Tenants"
          description="Manage every organisation by tier. For company-wide financials, see Revenue."
        />
        <Link
          href="/revenue"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          Financials <ArrowUpRight className="size-4" />
        </Link>
      </div>

      {/* Control by tier */}
      <div className="mb-5 flex flex-wrap gap-2">
        <TierChip label="All tiers" href="/tenants" count={enriched.length} active={!activeTier} />
        {TIER_ORDER.filter((t) => tierCounts.has(t)).map((t) => (
          <TierChip
            key={t}
            label={t}
            href={`/tenants?tier=${t}`}
            count={tierCounts.get(t) ?? 0}
            active={activeTier === t}
            tone={TIER_TONE[t]}
          />
        ))}
      </div>

      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Org</th>
              <th className="px-3 py-2 font-medium">Tier</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">Seats</th>
              <th className="px-3 py-2 text-right font-medium">MRR</th>
              <th className="px-3 py-2 text-right font-medium">Infra</th>
              <th className="px-3 py-2 text-right font-medium">Margin</th>
              <th className="px-3 py-2 text-right font-medium">Errors</th>
              <th className="px-3 py-2 text-right font-medium">Last run</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ row, fin }) => (
              <tr key={row.orgId} className="border-t border-foreground/5 hover:bg-muted/30">
                <td className="px-3 py-2">
                  <Link href={`/tenants/${row.orgId}`} className="font-medium hover:underline">
                    {row.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">{row.orgId}</div>
                </td>
                <td className="px-3 py-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", TIER_TONE[fin.tier])}>
                    {fin.tier}
                  </span>
                </td>
                <td className="px-3 py-2"><StatusPill status={row.status} /></td>
                <td className="px-3 py-2 text-right tabular-nums">{row.seats}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fin.mrrUsd === null ? "custom" : usd(fin.mrrUsd)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{usd(row.mtdUsdCost)}</td>
                <td className={cn("px-3 py-2 text-right tabular-nums", fin.marginUsd !== null && fin.marginUsd < 0 && "text-red-600 dark:text-red-400")}>
                  {fin.marginUsd === null ? "-" : usd(fin.marginUsd)}
                </td>
                <td className={cn("px-3 py-2 text-right tabular-nums", row.failureRate > 0.1 && "text-red-600 dark:text-red-400")}>
                  {pct(row.failureRate)}
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">{relativeTime(row.lastRunAt)}</td>
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  No tenants in this tier.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{compact(visible.length)} shown</p>
    </div>
  )
}

function TierChip({
  label,
  href,
  count,
  active,
  tone,
}: {
  label: string
  href: string
  count: number
  active: boolean
  tone?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium capitalize transition-colors",
        active ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
      )}
    >
      {!active && tone ? <span className={cn("size-2 rounded-full", tone)} /> : null}
      {label}
      <span className={cn("tabular-nums", active ? "opacity-80" : "text-muted-foreground")}>{count}</span>
    </Link>
  )
}

import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { OrgKey } from "@/components/control/org-key"
import {
  HealthBadge,
  OrgAvatar,
  PageHeading,
  StatItem,
  StatStrip,
  StatusPill,
  TierPill,
} from "@/components/control/widgets"
import { inr, relativeTime } from "@/lib/platform/format"
import { listOrgRows } from "@/lib/platform/queries"
import { tenantFinancials } from "@/lib/platform/revenue"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

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

  const activeCount = enriched.filter((e) => e.row.status === "active").length
  const customCount = enriched.filter((e) => e.fin.mrrInr === null).length
  const mrrTotal = enriched.reduce((s, e) => s + (e.fin.mrrInr ?? 0), 0)
  const infraTotal = enriched.reduce((s, e) => s + e.fin.infraMtdInr, 0)
  const marginTotal = enriched.reduce((s, e) => s + (e.fin.marginInr ?? 0), 0)
  const atRisk = enriched.filter(
    (e) => e.row.failureRate > 0.1 || (e.fin.marginInr !== null && e.fin.marginInr < 0),
  ).length

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <PageHeading
          title="Tenants"
          description="Every organisation by tier. For company-wide financials, see Revenue."
        />
        <Link
          href="/revenue"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          Financials <ArrowUpRight className="size-4" />
        </Link>
      </div>

      <StatStrip className="mb-8 grid-cols-2 lg:grid-cols-5">
        <StatItem label="Tenants" value={String(enriched.length)} sub={`${activeCount} active`} />
        <StatItem
          label="Portfolio MRR"
          value={inr(mrrTotal)}
          sub={customCount > 0 ? `+ ${customCount} custom` : undefined}
        />
        <StatItem label="Infra (MTD)" value={inr(infraTotal)} />
        <StatItem
          label="Blended margin"
          value={inr(marginTotal)}
          tone={marginTotal < 0 ? "negative" : undefined}
        />
        <StatItem
          label="At risk"
          value={String(atRisk)}
          sub="failing or negative margin"
          tone={atRisk > 0 ? "negative" : undefined}
          className="col-span-2 lg:col-span-1"
        />
      </StatStrip>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-full bg-muted p-1">
          <Segment label="All tiers" href="/tenants" count={enriched.length} active={!activeTier} />
          {TIER_ORDER.filter((t) => tierCounts.has(t)).map((t) => (
            <Segment
              key={t}
              label={t}
              href={`/tenants?tier=${t}`}
              count={tierCounts.get(t) ?? 0}
              active={activeTier === t}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          {visible.length} of {enriched.length}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-foreground/10 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Organisation</th>
              <th className="px-3 py-3 font-medium">Tier</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 text-right font-medium">Seats</th>
              <th className="px-3 py-3 text-right font-medium">MRR</th>
              <th className="px-3 py-3 text-right font-medium">Infra</th>
              <th className="px-3 py-3 text-right font-medium">Margin</th>
              <th className="px-3 py-3 text-right font-medium">Health</th>
              <th className="px-4 py-3 text-right font-medium">Last run</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ row, fin }) => (
              <tr
                key={row.orgId}
                className={cn(
                  "group border-b border-foreground/5 transition-colors last:border-0 hover:bg-muted/40",
                  row.status === "suspended" && "opacity-60",
                )}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Link href={`/tenants/${row.orgId}`}>
                      <OrgAvatar name={row.name} seed={row.orgId} />
                    </Link>
                    <span className="min-w-0">
                      <Link
                        href={`/tenants/${row.orgId}`}
                        className="block truncate font-medium hover:underline"
                      >
                        {row.name}
                      </Link>
                      {row.orgId === row.name ? null : (
                        <OrgKey orgId={row.orgId} className="-ml-1.5" />
                      )}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3"><TierPill tier={fin.tier} /></td>
                <td className="px-3 py-3"><StatusPill status={row.status} /></td>
                <td className="px-3 py-3 text-right tabular-nums">{row.seats}</td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {fin.mrrInr === null ? "custom" : inr(fin.mrrInr)}
                </td>
                <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                  {inr(fin.infraMtdInr)}
                </td>
                <td
                  className={cn(
                    "px-3 py-3 text-right tabular-nums",
                    fin.marginInr !== null && fin.marginInr < 0 && "text-red-600 dark:text-red-400",
                  )}
                >
                  {fin.marginInr === null ? "-" : inr(fin.marginInr)}
                </td>
                <td className="px-3 py-3 text-right">
                  <HealthBadge rate={row.failureRate} />
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {relativeTime(row.lastRunAt)}
                </td>
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-12 text-center text-muted-foreground">
                  No tenants in this tier.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Segment({
  label,
  href,
  count,
  active,
}: {
  label: string
  href: string
  count: number
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium capitalize transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
    </Link>
  )
}

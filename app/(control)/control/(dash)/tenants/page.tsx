import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { ReportExport } from "@/components/control/report-export"
import { TenantsTable, type TenantTableRow } from "@/components/control/tenants-table"
import {
  PageHeading,
  StatItem,
  StatStrip,
} from "@/components/control/widgets"
import { inr } from "@/lib/platform/format"
import { listOrgRows } from "@/lib/platform/queries"
import { tenantFinancials } from "@/lib/platform/revenue"

export const dynamic = "force-dynamic"

export default async function TenantsPage() {
  const allRows = await listOrgRows()

  const rows: TenantTableRow[] = allRows.map((row) => {
    const fin = tenantFinancials(row.plan, row.mtdUsdCost)
    return {
      orgId: row.orgId,
      name: row.name,
      tier: fin.tier,
      planLabel: fin.planLabel,
      status: row.status,
      seats: row.seats,
      mrrInr: fin.mrrInr,
      infraMtdInr: fin.infraMtdInr,
      marginInr: fin.marginInr,
      failureRate: row.failureRate,
      lastRunAt: row.lastRunAt,
      createdAt: row.createdAt,
      trialEndsAt: row.trialEndsAt,
      billingStatus: row.billingStatus,
      grandfathered: row.grandfathered,
    }
  })

  const activeCount = rows.filter((r) => r.status === "active").length
  const trialCount = rows.filter((r) => r.billingStatus === "trialing").length
  const customCount = rows.filter((r) => r.mrrInr === null).length
  const mrrTotal = rows.reduce((s, r) => s + (r.mrrInr ?? 0), 0)
  const infraTotal = rows.reduce((s, r) => s + r.infraMtdInr, 0)
  const marginTotal = rows.reduce((s, r) => s + (r.marginInr ?? 0), 0)
  const atRisk = rows.filter(
    (r) => r.failureRate > 0.1 || (r.marginInr !== null && r.marginInr < 0),
  ).length

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <PageHeading
          title="Tenants"
          description="Every organisation by tier. For company-wide financials, see Revenue."
        />
        <div className="flex shrink-0 items-center gap-2">
          <ReportExport />
          <Link
            href="/revenue"
            className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            Financials <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>

      <StatStrip className="mb-8 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatItem label="Tenants" value={String(rows.length)} sub={`${activeCount} active`} />
        <StatItem label="On trial" value={String(trialCount)} />
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
        />
      </StatStrip>

      <TenantsTable rows={rows} />
    </div>
  )
}

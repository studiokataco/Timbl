import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CreditCard } from "lucide-react"

import type { BillingProfile } from "@/lib/schemas/billing"
import { TenantBilling } from "@/components/control/tenant-billing"
import { TenantControls } from "@/components/control/tenant-controls"
import { CostDonut } from "@/components/control/charts"
import {
  PageHeading,
  StatCard,
  StatusPill,
} from "@/components/control/widgets"
import { getBillingProfile } from "@/lib/actions/platform/billing"
import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import { compact, duration, inr, pct, relativeTime } from "@/lib/platform/format"
import { getOrgPeriod, getOrgRow, listOrgRuns } from "@/lib/platform/queries"
import { tenantFinancials } from "@/lib/platform/revenue"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params
  const [actor, row, period, runs, billing] = await Promise.all([
    requirePlatformAdmin(),
    getOrgRow(orgId),
    getOrgPeriod(orgId),
    listOrgRuns(orgId, 20),
    getBillingProfile(orgId),
  ])
  if (!row) notFound()

  const isOwner = actor.role === "owner"
  const fin = tenantFinancials(row.plan, row.mtdUsdCost)
  const failures = runs.filter((r) => r.status === "failed")
  const modelSlices = Object.entries(period.byModel).map(([k, v]) => ({ name: k, value: v }))

  return (
    <div>
      <Link
        href="/tenants"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All tenants
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <PageHeading title={row.name} />
        <StatusPill status={row.status} />
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize">
          {fin.tier}
        </span>
      </div>

      {/* Financials snapshot */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="MRR" value={fin.mrrInr === null ? "custom" : inr(fin.mrrInr)} sub={fin.planLabel} />
        <StatCard label="ARR" value={fin.arrInr === null ? "custom" : inr(fin.arrInr)} />
        <StatCard label="Infra (MTD)" value={inr(fin.infraMtdInr)} sub={`${compact(row.mtdAgentRuns)} runs`} />
        <StatCard
          label="Margin"
          value={fin.marginInr === null ? "-" : inr(fin.marginInr)}
          delta={fin.marginInr !== null && fin.marginInr < 0 ? "negative" : undefined}
        />
        <StatCard label="Seats" value={`${row.seats} / ${fin.includedSeats}`} sub="used / included" />
      </div>

      {/* God-mode controls - owners only */}
      {isOwner ? (
        <section className="mt-8">
          <h2 className="mb-3 font-heading text-sm font-semibold tracking-tight">
            God-mode controls
          </h2>
          <TenantControls orgId={orgId} plan={row.plan} status={row.status} />
        </section>
      ) : null}

      {/* Billing + payments */}
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        {isOwner ? (
          <TenantBilling orgId={orgId} profile={billing} />
        ) : (
          <BillingReadOnly billing={billing} />
        )}
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="mb-3 flex items-center gap-2">
            <CreditCard className="size-4 text-muted-foreground" />
            <h2 className="font-heading text-sm font-semibold tracking-tight">
              Invoices & payments
            </h2>
          </div>
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center">
            <p className="text-sm font-medium">Awaiting Razorpay (Phase H)</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Real invoices, transactions, and card details land here once
              billing is wired. Status today is tracked manually in the billing
              profile.
            </p>
            <span className="mt-1 rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
              status: {billing.status}
            </span>
          </div>
        </div>
      </section>

      {/* Errors */}
      <section className="mt-8">
        <h2 className="mb-3 font-heading text-sm font-semibold tracking-tight">
          Errors <span className="text-muted-foreground">· {pct(row.failureRate)} failure rate</span>
        </h2>
        <div className="flex flex-col gap-2">
          {failures.map((run) => (
            <div key={run.id} className="flex items-center justify-between gap-3 rounded-lg bg-card px-3 py-2 text-sm ring-1 ring-foreground/10">
              <div className="min-w-0">
                <div className="truncate font-medium">{run.agentName}</div>
                <div className="truncate text-xs text-red-600 dark:text-red-400">{run.error ?? "no message"}</div>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(run.startedAt)}</span>
            </div>
          ))}
          {failures.length === 0 ? (
            <p className="rounded-lg bg-card px-3 py-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
              No recent errors.
            </p>
          ) : null}
        </div>
      </section>

      {/* Cost + runs */}
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="mb-4 font-heading text-sm font-semibold tracking-tight">
            Cost by model (MTD)
          </h2>
          <CostDonut data={modelSlices} />
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="mb-4 font-heading text-sm font-semibold tracking-tight">
            Recent runs
          </h2>
          <ul className="flex flex-col">
            {runs.slice(0, 8).map((run) => (
              <li key={run.id} className="flex items-center gap-3 border-b border-foreground/5 py-1.5 text-sm last:border-0">
                <span className="min-w-0 flex-1 truncate">{run.agentName}</span>
                <StatusPill status={run.status} />
                <span className={cn("w-14 shrink-0 text-right text-xs text-muted-foreground tabular-nums")}>
                  {duration(run.durationMs)}
                </span>
              </li>
            ))}
            {runs.length === 0 ? (
              <li className="py-6 text-center text-muted-foreground">No runs yet.</li>
            ) : null}
          </ul>
        </div>
      </section>
    </div>
  )
}

function BillingReadOnly({ billing }: { billing: BillingProfile }) {
  const rows: [string, string][] = [
    ["Company", billing.companyName || "-"],
    ["Billing email", billing.billingEmail || "-"],
    ["Tax / VAT ID", billing.taxId || "-"],
    ["Country", billing.country || "-"],
    ["Currency", billing.currency || "USD"],
    ["Status", billing.status],
    ["Payment method", billing.paymentMethod || "-"],
  ]
  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-heading text-sm font-semibold tracking-tight">Billing profile</h2>
        <span className="text-xs text-muted-foreground">read-only</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="truncate text-right capitalize">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

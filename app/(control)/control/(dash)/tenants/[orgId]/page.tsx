import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CreditCard } from "lucide-react"

import type { BillingProfile } from "@/lib/schemas/billing"
import { TenantBilling } from "@/components/control/tenant-billing"
import { TenantControls } from "@/components/control/tenant-controls"
import { TenantOverview } from "@/components/control/tenant-overview"
import { TenantTeam } from "@/components/control/tenant-team"
import { TenantInventory } from "@/components/control/tenant-inventory"
import { TenantUsage } from "@/components/control/tenant-usage"
import { TenantActivity } from "@/components/control/tenant-activity"
import { CostDonut, SpendTrendChart } from "@/components/control/charts"
import { OrgKey } from "@/components/control/org-key"
import {
  OrgAvatar,
  Panel,
  StatItem,
  StatStrip,
  StatusPill,
  TierPill,
} from "@/components/control/widgets"
import { getBillingProfile } from "@/lib/actions/platform/billing"
import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import { compact, duration, inr, pct, relativeTime } from "@/lib/platform/format"
import { getOrgPeriod, getOrgRow, listOrgRuns } from "@/lib/platform/queries"
import {
  getOrgAuditFeed,
  getOrgImpersonations,
  getOrgInventory,
  getOrgPeriods,
  getOrgProfile,
  getOrgTeam,
  getOrgUsage,
  orgDailyTrend,
} from "@/lib/platform/tenant-detail"
import { tenantFinancials } from "@/lib/platform/revenue"

export const dynamic = "force-dynamic"

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params
  const [
    actor,
    row,
    profile,
    period,
    runs,
    billing,
    team,
    inventory,
    trend,
    periods,
    audit,
    impersonations,
  ] = await Promise.all([
    requirePlatformAdmin(),
    getOrgRow(orgId),
    getOrgProfile(orgId),
    getOrgPeriod(orgId),
    listOrgRuns(orgId, 20),
    getBillingProfile(orgId),
    getOrgTeam(orgId),
    getOrgInventory(orgId),
    orgDailyTrend(orgId),
    getOrgPeriods(orgId),
    getOrgAuditFeed(orgId),
    getOrgImpersonations(orgId),
  ])
  if (!row) notFound()

  const usage = await getOrgUsage(orgId, row.plan, profile?.quotaOverrides ?? {})

  const isOwner = actor.role === "owner"
  const fin = tenantFinancials(row.plan, row.mtdUsdCost)
  const modelSlices = Object.entries(period.byModel).map(([k, v]) => ({ name: k, value: v }))

  return (
    <div>
      <Link
        href="/tenants"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All tenants
      </Link>

      <div className="mb-8 flex flex-wrap items-center gap-4">
        <OrgAvatar name={row.name} seed={row.orgId} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{row.name}</h1>
            <StatusPill status={row.status} />
            <TierPill tier={fin.tier} />
            {row.grandfathered ? (
              <span className="inline-flex items-center rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-400">
                Grandfathered
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <OrgKey orgId={row.orgId} className="-ml-1.5" />
            <span>· {fin.planLabel} · last run {relativeTime(row.lastRunAt)}</span>
          </div>
        </div>
      </div>

      <StatStrip className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatItem
          label="MRR"
          value={fin.mrrInr === null ? "custom" : inr(fin.mrrInr)}
          sub={fin.planLabel}
        />
        <StatItem label="ARR" value={fin.arrInr === null ? "custom" : inr(fin.arrInr)} />
        <StatItem
          label="Infra (MTD)"
          value={inr(fin.infraMtdInr)}
          sub={`${compact(row.mtdAgentRuns)} runs`}
        />
        <StatItem
          label="Margin"
          value={fin.marginInr === null ? "-" : inr(fin.marginInr)}
          tone={fin.marginInr !== null && fin.marginInr < 0 ? "negative" : undefined}
        />
        <StatItem label="Seats" value={`${row.seats} / ${fin.includedSeats}`} sub="used / included" />
        <StatItem
          label="Failure rate"
          value={pct(row.failureRate)}
          tone={row.failureRate > 0.1 ? "negative" : undefined}
        />
      </StatStrip>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-5">
        <div className="flex flex-col gap-6 lg:col-span-3">
          <Panel title="Spend trend" sub="last 14 days">
            <SpendTrendChart data={trend} />
          </Panel>

          <TenantUsage usage={usage} periods={periods} />

          <Panel title="Recent runs" sub={`${pct(row.failureRate)} failure rate`} bodyClassName="p-2">
            <ul className="flex flex-col">
              {runs.slice(0, 10).map((run) => (
                <li
                  key={run.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-medium">{run.agentName}</span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {duration(run.durationMs)} · {relativeTime(run.startedAt)}
                      </span>
                    </div>
                    {run.error ? (
                      <p className="mt-0.5 truncate text-xs text-red-600 dark:text-red-400">
                        {run.error}
                      </p>
                    ) : null}
                  </div>
                  <StatusPill status={run.status} />
                </li>
              ))}
              {runs.length === 0 ? (
                <li className="py-10 text-center text-sm text-muted-foreground">No runs yet.</li>
              ) : null}
            </ul>
          </Panel>

          <Panel title="Cost by model (MTD)">
            <CostDonut data={modelSlices} />
          </Panel>

          <TenantActivity entries={audit} impersonations={impersonations} />

          {isOwner ? (
            <TenantBilling orgId={orgId} profile={billing} />
          ) : (
            <BillingReadOnly billing={billing} />
          )}
        </div>

        <div className="flex flex-col gap-6 lg:col-span-2">
          {isOwner ? (
            <TenantControls
              orgId={orgId}
              name={row.name}
              plan={row.plan}
              status={row.status}
              suspendedAt={row.suspendedAt}
              billingStatus={row.billingStatus}
              trialEndsAt={row.trialEndsAt}
              featureFlags={profile?.featureFlags ?? {}}
            />
          ) : null}

          {profile ? <TenantOverview profile={profile} /> : null}

          <TenantTeam team={team} />

          <TenantInventory inventory={inventory} />

          <Panel title="Invoices & payments">
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center">
              <CreditCard className="size-5 text-muted-foreground" />
              <p className="text-sm font-medium">Awaiting Razorpay (Phase H)</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Real invoices, transactions, and card details land here once
                billing is wired. Status today is tracked manually in the
                billing profile.
              </p>
              <span className="mt-1 rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
                status: {billing.status}
              </span>
            </div>
          </Panel>
        </div>
      </div>
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
    <Panel title="Billing profile" sub="read-only">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="truncate text-right capitalize">{v}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  )
}

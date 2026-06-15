import { ActiveOrgChart } from "@/components/control/charts"
import { MetricCard } from "@/components/control/metric-card"
import { CohortHeatmap } from "@/components/control/retention-heatmap"
import { PageHeading } from "@/components/control/widgets"
import { pct } from "@/lib/platform/format"
import { getRetentionData } from "@/lib/platform/retention"

export const dynamic = "force-dynamic"

function ratio(now: number, prev: number): number | null {
  return prev > 0 ? (now - prev) / prev : null
}

function delta(now: number, prev: number, unit: string): string {
  const diff = now - prev
  if (diff === 0) return `Flat vs ${unit}`
  return `${diff > 0 ? "Up" : "Down"} ${Math.abs(diff)} vs ${unit}`
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border bg-card shadow-xs">
      <header className="flex flex-col gap-1 border-b px-5 py-4">
        <h2 className="font-heading text-sm font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

export default async function ControlRetentionPage() {
  const { cohorts, maxCol, active } = await getRetentionData()

  return (
    <div>
      <PageHeading
        title="Retention"
        description="Tenant retention - an org counts as active in a period when it ran at least one agent. Cohorts are keyed by signup month."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Active orgs (30d)"
          value={`${active.mao}`}
          deltaPct={ratio(active.mao, active.maoPrev)}
          foot={delta(active.mao, active.maoPrev, "prior 30 days")}
          footHint="Distinct orgs running agents"
        />
        <MetricCard
          label="Stickiness"
          value={pct(active.stickiness)}
          foot={`${active.dao} active today`}
          footHint={`${active.wao} active in the last 7 days`}
          tone="flat"
        />
        <MetricCard
          label="New orgs this month"
          value={`${active.newThisMonth}`}
          deltaPct={ratio(active.newThisMonth, active.newLastMonth)}
          foot={delta(active.newThisMonth, active.newLastMonth, "last month")}
          footHint="Orgs created this month"
        />
        <MetricCard
          label="Churned last month"
          value={`${active.churnedLastMonth}`}
          foot="Active last month, silent now"
          footHint="Orgs that stopped running agents"
          tone={active.churnedLastMonth > 0 ? "down" : "flat"}
        />
      </div>

      <div className="mt-6 grid gap-6">
        <SectionCard
          title="Active orgs - last 12 months"
          description="Distinct orgs that ran at least one agent in each calendar month."
        >
          <ActiveOrgChart data={active.trend} />
        </SectionCard>

        <SectionCard
          title="Cohort retention"
          description="Share of each signup-month cohort still running agents N months later."
        >
          <CohortHeatmap cohorts={cohorts} maxCol={maxCol} />
        </SectionCard>
      </div>
    </div>
  )
}

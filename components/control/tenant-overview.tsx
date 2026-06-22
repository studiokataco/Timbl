import { Panel } from "@/components/control/widgets"
import type { OrgProfile } from "@/lib/platform/tenant-detail"

function shortDate(iso: string | null): string {
  if (!iso) return "-"
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return "-"
  return new Date(t).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function TenantOverview({ profile }: { profile: OrgProfile }) {
  const trial =
    profile.billingStatus === "trialing" && profile.trialEndsAt
      ? `${profile.trialDaysLeft ?? 0}d left · ends ${shortDate(profile.trialEndsAt)}`
      : profile.trialStartedAt
        ? `Used · started ${shortDate(profile.trialStartedAt)}`
        : "Never"

  const rows: [string, React.ReactNode][] = [
    ["Created", shortDate(profile.createdAt)],
    ["Billing status", profile.billingStatus ?? "manual"],
    ["Trial", trial],
    ["Grandfathered", profile.grandfathered ? `Yes · ${shortDate(profile.grandfatheredAt)}` : "No"],
    ["Onboarding", profile.onboardingCompletedAt ? shortDate(profile.onboardingCompletedAt) : "Incomplete"],
    ["Industry", profile.profile.industry ?? "-"],
    ["Audience", profile.profile.audience ?? "-"],
    ["Tone", profile.profile.tone ?? "-"],
  ]

  return (
    <Panel title="Overview">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="truncate text-right capitalize" title={typeof v === "string" ? v : undefined}>
              {v}
            </dd>
          </div>
        ))}
      </dl>
      {profile.profile.channels.length > 0 ? (
        <div className="mt-4 border-t border-foreground/5 pt-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Preferred channels</p>
          <div className="flex flex-wrap gap-1.5">
            {profile.profile.channels.map((c) => (
              <span
                key={c}
                className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </Panel>
  )
}

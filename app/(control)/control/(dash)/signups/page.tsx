import { PageHeading, StatItem, StatStrip } from "@/components/control/widgets"
import { SignupRequestsTable } from "@/components/control/signup-requests-table"
import { listSignupRequests } from "@/lib/platform/queries"

export const dynamic = "force-dynamic"

export default async function SignupsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status: activeStatus = "pending" } = await searchParams
  const safeStatus =
    activeStatus === "approved" || activeStatus === "denied" ? activeStatus : "pending"

  const [pending, decided] = await Promise.all([
    listSignupRequests("pending"),
    listSignupRequests(safeStatus === "pending" ? "approved" : safeStatus),
  ])

  const requests = safeStatus === "pending" ? pending : decided

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <PageHeading
          title="Beta signups"
          description="Review and approve invite requests from /request-invite."
        />
      </div>

      <StatStrip className="mb-6 grid-cols-3">
        <StatItem label="Pending" value={String(pending.length)} />
        <StatItem label="Status filter" value={safeStatus} />
        <StatItem label="Shown" value={String(requests.length)} />
      </StatStrip>

      <div className="mb-4 inline-flex items-center gap-1 rounded-full bg-muted p-1">
        {(["pending", "approved", "denied"] as const).map((s) => (
          <a
            key={s}
            href={`/signups?status=${s}`}
            className={[
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium capitalize transition-colors",
              safeStatus === s
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {s}
          </a>
        ))}
      </div>

      <SignupRequestsTable requests={requests} status={safeStatus} />
    </div>
  )
}

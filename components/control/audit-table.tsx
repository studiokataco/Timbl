import { OrgKey } from "@/components/control/org-key"
import { relativeTime } from "@/lib/platform/format"
import type { PlatformAuditAction, PlatformAuditEntry, PlatformSignalKind } from "@/lib/platform/schema"
import { cn } from "@/lib/utils"

export const ACTION_LABEL: Record<PlatformAuditAction, string> = {
  "org.suspend": "Org suspended",
  "org.reactivate": "Org reactivated",
  "org.delete": "Org deleted",
  "org.auto_delete": "Org auto-deleted",
  "org.rename": "Org renamed",
  "plan.change": "Plan changed",
  "quota.override": "Quota override",
  "agent.force_run": "Agent force run",
  "agent.cancel": "Agent cancelled",
  "trial.start": "Trial started",
  "trial.extend": "Trial extended",
  "trial.cancel": "Trial cancelled",
  "grandfather.set": "Grandfather set",
  "feature_flag.set": "Feature flag set",
  "impersonation.start": "Impersonation started",
  "impersonation.end": "Impersonation ended",
  "admin.grant": "Admin granted",
  "admin.revoke": "Admin revoked",
  "billing.update": "Billing updated",
  "signup.approve": "Signup approved",
  "signup.deny": "Signup denied",
  "user.claims_remint": "Claims re-minted",
  "user.membership_assign": "Membership assigned",
  "config.realtime_default": "Realtime default changed",
}

export const ACTION_TONE: Record<PlatformAuditAction, string> = {
  "org.suspend": "bg-red-500/15 text-red-700 dark:text-red-400",
  "org.reactivate": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  "org.delete": "bg-red-500/15 text-red-700 dark:text-red-400",
  "org.auto_delete": "bg-red-500/15 text-red-700 dark:text-red-400",
  "org.rename": "bg-muted text-muted-foreground",
  "plan.change": "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  "quota.override": "bg-amber-500/15 text-amber-700 dark:text-amber-500",
  "agent.force_run": "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  "agent.cancel": "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  "trial.start": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  "trial.extend": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  "trial.cancel": "bg-amber-500/15 text-amber-700 dark:text-amber-500",
  "grandfather.set": "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  "feature_flag.set": "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  "impersonation.start": "bg-pink-500/15 text-pink-700 dark:text-pink-400",
  "impersonation.end": "bg-pink-500/15 text-pink-700 dark:text-pink-400",
  "admin.grant": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  "admin.revoke": "bg-red-500/15 text-red-700 dark:text-red-400",
  "billing.update": "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  "signup.approve": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  "signup.deny": "bg-red-500/15 text-red-700 dark:text-red-400",
  "user.claims_remint": "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  "user.membership_assign": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  "config.realtime_default": "bg-blue-500/15 text-blue-700 dark:text-blue-400",
}

export function ActionPill({ action }: { action: PlatformAuditAction }) {
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        ACTION_TONE[action] ?? "bg-muted text-muted-foreground",
      )}
    >
      {ACTION_LABEL[action] ?? action}
    </span>
  )
}

export const SIGNAL_LABEL: Record<PlatformSignalKind, string> = {
  "signup.requested": "New signup",
  "agent.failed": "Agent failed",
  "quota.breached": "Quota exceeded",
  "diagnostic.critical": "Critical finding",
}

export const SIGNAL_TONE: Record<PlatformSignalKind, string> = {
  "signup.requested": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  "agent.failed": "bg-red-500/15 text-red-700 dark:text-red-400",
  "quota.breached": "bg-amber-500/15 text-amber-700 dark:text-amber-500",
  "diagnostic.critical": "bg-red-500/15 text-red-700 dark:text-red-400",
}

export function SignalPill({ kind }: { kind: PlatformSignalKind }) {
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        SIGNAL_TONE[kind] ?? "bg-muted text-muted-foreground",
      )}
    >
      {SIGNAL_LABEL[kind] ?? kind}
    </span>
  )
}

export function AuditTable({
  entries,
  orgNames = {},
}: {
  entries: PlatformAuditEntry[]
  orgNames?: Record<string, string>
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl bg-card py-12 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
        No audit entries match this filter.
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-2 md:hidden">
        {entries.map((entry) => {
          const hasDetail = Object.keys(entry.meta).length > 0
          return (
            <div key={entry.id} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <ActionPill action={entry.action} />
                <span className="text-xs text-muted-foreground" title={entry.createdAt}>
                  {relativeTime(entry.createdAt)}
                </span>
              </div>
              {entry.targetOrgId ? (
                <div className="mt-2 text-sm font-medium">
                  {orgNames[entry.targetOrgId] ?? entry.targetOrgId}
                </div>
              ) : null}
              <div className="mt-1 text-xs text-muted-foreground">{entry.actorEmail}</div>
              {hasDetail ? (
                <details className="group mt-2">
                  <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground hover:text-foreground group-open:text-foreground">
                    <span className="group-open:hidden">Show payload</span>
                    <span className="hidden group-open:inline">Hide payload</span>
                  </summary>
                  <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/50 p-2 font-mono text-xs">
                    {JSON.stringify(entry.meta, null, 2)}
                  </pre>
                </details>
              ) : null}
            </div>
          )
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-xl ring-1 ring-foreground/10 md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Admin</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Org</th>
              <th className="px-3 py-2 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <AuditRow key={entry.id} entry={entry} orgNames={orgNames} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function AuditRow({
  entry,
  orgNames,
}: {
  entry: PlatformAuditEntry
  orgNames: Record<string, string>
}) {
  const hasDetail = Object.keys(entry.meta).length > 0
  return (
    <tr className="border-t border-foreground/5 align-top hover:bg-muted/30">
      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground" title={entry.createdAt}>
        {relativeTime(entry.createdAt)}
      </td>
      <td className="px-3 py-2">
        <span className="font-medium">{entry.actorEmail}</span>
        <div className="text-xs text-muted-foreground">{entry.actorUid}</div>
      </td>
      <td className="px-3 py-2">
        <ActionPill action={entry.action} />
      </td>
      <td className="px-3 py-2">
        {entry.targetOrgId ? (
          <div className="flex flex-col items-start gap-0.5">
            <span className="font-medium">
              {orgNames[entry.targetOrgId] ?? entry.targetOrgId}
            </span>
            <OrgKey orgId={entry.targetOrgId} className="-ml-1.5" />
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
        {entry.target ? (
          <div className="text-xs text-muted-foreground">
            {entry.target.type}: {entry.target.label ?? entry.target.id}
          </div>
        ) : null}
      </td>
      <td className="max-w-72 px-3 py-2">
        {hasDetail ? (
          <details className="group">
            <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground hover:text-foreground group-open:text-foreground">
              <span className="group-open:hidden">Show payload</span>
              <span className="hidden group-open:inline">Hide payload</span>
            </summary>
            <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/50 p-2 font-mono text-xs">
              {JSON.stringify(entry.meta, null, 2)}
            </pre>
          </details>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>
    </tr>
  )
}

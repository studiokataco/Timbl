import { relativeTime } from "@/lib/platform/format"
import type { PlatformAuditAction, PlatformAuditEntry } from "@/lib/platform/schema"
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
  "impersonation.start": "Impersonation started",
  "impersonation.end": "Impersonation ended",
  "admin.grant": "Admin granted",
  "admin.revoke": "Admin revoked",
  "billing.update": "Billing updated",
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
  "impersonation.start": "bg-pink-500/15 text-pink-700 dark:text-pink-400",
  "impersonation.end": "bg-pink-500/15 text-pink-700 dark:text-pink-400",
  "admin.grant": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  "admin.revoke": "bg-red-500/15 text-red-700 dark:text-red-400",
  "billing.update": "bg-violet-500/15 text-violet-700 dark:text-violet-400",
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

export function AuditTable({ entries }: { entries: PlatformAuditEntry[] }) {
  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">When</th>
            <th className="px-3 py-2 font-medium">Actor</th>
            <th className="px-3 py-2 font-medium">Action</th>
            <th className="px-3 py-2 font-medium">Org</th>
            <th className="px-3 py-2 font-medium">Detail</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <AuditRow key={entry.id} entry={entry} />
          ))}
          {entries.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                No audit entries match this filter.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}

function AuditRow({ entry }: { entry: PlatformAuditEntry }) {
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
        {entry.targetOrgId ?? <span className="text-muted-foreground">-</span>}
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

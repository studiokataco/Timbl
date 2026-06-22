import { AuditTable } from "@/components/control/audit-table"
import { Panel } from "@/components/control/widgets"
import { relativeTime } from "@/lib/platform/format"
import type { PlatformAuditEntry } from "@/lib/platform/schema"
import type { OrgImpersonation } from "@/lib/platform/tenant-detail"

export function TenantActivity({
  entries,
  impersonations,
}: {
  entries: PlatformAuditEntry[]
  impersonations: OrgImpersonation[]
}) {
  return (
    <Panel title="Activity" sub={`${entries.length} recent actions`}>
      {impersonations.length > 0 ? (
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Impersonation history</p>
          <ul className="flex flex-col gap-1.5">
            {impersonations.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{s.adminEmail}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {relativeTime(s.createdAt)}
                </span>
                <span className="shrink-0 rounded-full bg-pink-500/15 px-2 py-0.5 text-xs font-medium text-pink-700 dark:text-pink-400">
                  {s.state}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <AuditTable entries={entries} />
    </Panel>
  )
}

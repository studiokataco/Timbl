import { OrgAvatar, Panel } from "@/components/control/widgets"
import type { OrgTeam } from "@/lib/platform/tenant-detail"
import { cn } from "@/lib/utils"

const ROLE_TONE: Record<string, string> = {
  admin: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  editor: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  contributor: "bg-muted text-muted-foreground",
}

export function TenantTeam({ team }: { team: OrgTeam }) {
  const sub = [
    team.pendingInvites > 0 ? `${team.pendingInvites} invited` : null,
    team.accessRequests > 0 ? `${team.accessRequests} requesting` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <Panel title="Team" sub={sub || `${team.members.length} members`} bodyClassName="p-2">
      <ul className="flex flex-col">
        {team.members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/40">
            <OrgAvatar name={m.name} seed={m.id} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {m.name}
                {m.active ? null : <span className="ml-1 text-xs text-muted-foreground">(inactive)</span>}
              </div>
              <div className="truncate text-xs text-muted-foreground">{m.email}</div>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                ROLE_TONE[m.role] ?? "bg-muted text-muted-foreground",
              )}
            >
              {m.role}
            </span>
          </li>
        ))}
        {team.members.length === 0 ? (
          <li className="py-8 text-center text-sm text-muted-foreground">No members yet.</li>
        ) : null}
      </ul>
    </Panel>
  )
}

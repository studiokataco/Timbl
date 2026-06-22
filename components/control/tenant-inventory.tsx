import { FileText, FolderTree, LayoutTemplate, Bot } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Panel } from "@/components/control/widgets"
import { compact } from "@/lib/platform/format"
import type { OrgInventory } from "@/lib/platform/tenant-detail"
import { cn } from "@/lib/utils"

const ACCOUNT_TONE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  needs_reauth: "bg-amber-500/15 text-amber-700 dark:text-amber-500",
  revoked: "bg-red-500/15 text-red-700 dark:text-red-400",
}

export function TenantInventory({ inventory }: { inventory: OrgInventory }) {
  const counts: [string, number, LucideIcon][] = [
    ["Posts", inventory.posts, FileText],
    ["Categories", inventory.categories, FolderTree],
    ["Templates", inventory.templates, LayoutTemplate],
    ["Agents", inventory.agents, Bot],
  ]

  return (
    <Panel title="Inventory & integrations">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {counts.map(([label, value, Icon]) => (
          <div key={label} className="rounded-lg bg-muted/40 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Icon className="size-3.5" /> {label}
            </div>
            <div className="mt-1 font-heading text-xl font-semibold tabular-nums">
              {compact(value)}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-foreground/5 pt-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Connected accounts</p>
        {inventory.accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No channels connected.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {inventory.accounts.map((a) => (
              <li key={`${a.channel}:${a.displayName}`} className="flex items-center gap-2 text-sm">
                <span className="font-medium capitalize">{a.channel}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{a.displayName}</span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                    ACCOUNT_TONE[a.status] ?? "bg-muted text-muted-foreground",
                  )}
                >
                  {a.status.replace(/_/g, " ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  )
}

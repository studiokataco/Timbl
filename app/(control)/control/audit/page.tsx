import Link from "next/link"

import { ACTION_LABEL, AuditTable } from "@/components/control/audit-table"
import { PageHeading } from "@/components/control/widgets"
import { compact } from "@/lib/platform/format"
import { getPlatformAuditFeed } from "@/lib/platform/audit"
import { platformAuditAction, type PlatformAuditAction } from "@/lib/platform/schema"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 1000

function auditHref(params: { action?: string; org?: string; limit?: number }) {
  const sp = new URLSearchParams()
  if (params.action) sp.set("action", params.action)
  if (params.org) sp.set("org", params.org)
  if (params.limit && params.limit !== DEFAULT_LIMIT) sp.set("limit", String(params.limit))
  const qs = sp.toString()
  return qs ? `/audit?${qs}` : "/audit"
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; org?: string; limit?: string }>
}) {
  const raw = await searchParams
  const parsedAction = platformAuditAction.safeParse(raw.action)
  const activeAction = parsedAction.success ? parsedAction.data : undefined
  const activeOrg = raw.org || undefined
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(DEFAULT_LIMIT, Number.parseInt(raw.limit ?? "", 10) || DEFAULT_LIMIT),
  )

  const { entries, hasMore } = await getPlatformAuditFeed(limit)

  const actionCounts = new Map<PlatformAuditAction, number>()
  const orgCounts = new Map<string, number>()
  for (const e of entries) {
    actionCounts.set(e.action, (actionCounts.get(e.action) ?? 0) + 1)
    if (e.targetOrgId) orgCounts.set(e.targetOrgId, (orgCounts.get(e.targetOrgId) ?? 0) + 1)
  }

  const visible = entries.filter(
    (e) =>
      (!activeAction || e.action === activeAction) &&
      (!activeOrg || e.targetOrgId === activeOrg),
  )

  return (
    <div>
      <PageHeading
        title="Audit log"
        description="Forensic trail of every god-mode action across the platform."
      />

      <div className="mb-3 flex flex-wrap gap-2">
        <FilterChip
          label="All actions"
          href={auditHref({ org: activeOrg, limit })}
          count={entries.length}
          active={!activeAction}
        />
        {[...actionCounts.entries()].map(([action, count]) => (
          <FilterChip
            key={action}
            label={ACTION_LABEL[action]}
            href={auditHref({ action, org: activeOrg, limit })}
            count={count}
            active={activeAction === action}
          />
        ))}
      </div>

      {orgCounts.size > 0 ? (
        <div className="mb-5 flex flex-wrap gap-2">
          <FilterChip
            label="All orgs"
            href={auditHref({ action: activeAction, limit })}
            count={entries.length}
            active={!activeOrg}
          />
          {[...orgCounts.entries()].map(([org, count]) => (
            <FilterChip
              key={org}
              label={org}
              href={auditHref({ action: activeAction, org, limit })}
              count={count}
              active={activeOrg === org}
            />
          ))}
        </div>
      ) : null}

      <AuditTable entries={visible} />

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {compact(visible.length)} shown · newest {compact(entries.length)} entries scanned
        </p>
        {hasMore ? (
          <Link
            href={auditHref({ action: activeAction, org: activeOrg, limit: Math.min(MAX_LIMIT, limit * 2) })}
            className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            Load more
          </Link>
        ) : null}
      </div>
    </div>
  )
}

function FilterChip({
  label,
  href,
  count,
  active,
}: {
  label: string
  href: string
  count: number
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
      )}
    >
      {label}
      <span className={cn("tabular-nums", active ? "opacity-80" : "text-muted-foreground")}>{count}</span>
    </Link>
  )
}

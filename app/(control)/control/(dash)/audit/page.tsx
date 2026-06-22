import Link from "next/link"

import { AuditFilters } from "@/components/control/audit-filters"
import { AuditTable } from "@/components/control/audit-table"
import { PageHeading } from "@/components/control/widgets"
import { compact } from "@/lib/platform/format"
import { getPlatformAuditFeed } from "@/lib/platform/audit"
import { listOrgRows } from "@/lib/platform/queries"
import { platformAuditAction } from "@/lib/platform/schema"

export const dynamic = "force-dynamic"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

type AuditSearchParams = {
  action?: string
  org?: string
  actor?: string
  after?: string
  before?: string
  sort?: string
  cursor?: string
}

function auditHref(params: AuditSearchParams) {
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) sp.set(key, value)
  }
  const qs = sp.toString()
  return qs ? `/audit?${qs}` : "/audit"
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<AuditSearchParams>
}) {
  const raw = await searchParams

  const parsedAction = platformAuditAction.safeParse(raw.action)
  const action = parsedAction.success ? parsedAction.data : undefined
  const org = raw.org || undefined
  const actor = raw.actor?.trim() || undefined
  const after = DATE_RE.test(raw.after ?? "") ? raw.after : undefined
  const before = DATE_RE.test(raw.before ?? "") ? raw.before : undefined
  const sort: "asc" | "desc" = raw.sort === "asc" ? "asc" : "desc"
  const cursor = raw.cursor || undefined

  const [{ entries, hasMore, nextCursor }, orgRows] = await Promise.all([
    getPlatformAuditFeed({
      action,
      org,
      actorEmail: actor,
      after: after ? `${after}T00:00:00.000Z` : undefined,
      before: before ? `${before}T23:59:59.999Z` : undefined,
      sort,
      cursor,
    }),
    listOrgRows(),
  ])

  const orgNames = Object.fromEntries(orgRows.map((r) => [r.orgId, r.name]))
  const orgOptions = orgRows
    .map((r) => ({ id: r.orgId, name: r.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const actorSuggestions = [...new Set(entries.map((e) => e.actorEmail))].sort()

  const baseParams: AuditSearchParams = {
    action,
    org,
    actor,
    after,
    before,
    sort: sort === "asc" ? "asc" : undefined,
  }

  return (
    <div>
      <PageHeading
        title="Audit log"
        description="Forensic trail of every god-mode action across the platform."
      />

      <AuditFilters
        action={action}
        org={org}
        actor={actor}
        after={after}
        before={before}
        sort={sort}
        orgOptions={orgOptions}
        actorSuggestions={actorSuggestions}
      />

      <AuditTable entries={entries} orgNames={orgNames} />

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {compact(entries.length)} {entries.length === 1 ? "entry" : "entries"} shown
        </p>
        <div className="flex items-center gap-2">
          {cursor ? (
            <Link
              href={auditHref(baseParams)}
              className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              First page
            </Link>
          ) : null}
          {hasMore && nextCursor ? (
            <Link
              href={auditHref({ ...baseParams, cursor: nextCursor })}
              className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              Next page
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}

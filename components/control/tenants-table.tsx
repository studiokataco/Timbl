"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowDown, ArrowUp, Search } from "lucide-react"

import { OrgKey } from "@/components/control/org-key"
import {
  HealthBadge,
  OrgAvatar,
  StatusPill,
  TierPill,
} from "@/components/control/widgets"
import { inr, relativeTime } from "@/lib/platform/format"
import { cn } from "@/lib/utils"

export interface TenantTableRow {
  orgId: string
  name: string
  tier: string
  planLabel: string
  status: "active" | "suspended"
  seats: number
  mrrInr: number | null
  infraMtdInr: number
  marginInr: number | null
  failureRate: number
  lastRunAt: string | null
  createdAt: string | null
  trialEndsAt: string | null
  billingStatus: string | null
  grandfathered: boolean
}

type Lifecycle = "all" | "active" | "suspended" | "trialing"
type SortKey =
  | "name"
  | "createdAt"
  | "seats"
  | "mrrInr"
  | "infraMtdInr"
  | "marginInr"
  | "failureRate"
  | "lastRunAt"

const TIER_ORDER = ["free", "trial", "studio", "agency", "scale"]

function trialDaysLeft(row: TenantTableRow): number | null {
  if (row.billingStatus !== "trialing" || !row.trialEndsAt) return null
  return Math.max(0, Math.ceil((Date.parse(row.trialEndsAt) - Date.now()) / 86_400_000))
}

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

export function TenantsTable({ rows }: { rows: TenantTableRow[] }) {
  const [query, setQuery] = useState("")
  const [tier, setTier] = useState<string | null>(null)
  const [lifecycle, setLifecycle] = useState<Lifecycle>("all")
  const [sortKey, setSortKey] = useState<SortKey>("infraMtdInr")
  const [dir, setDir] = useState<"asc" | "desc">("desc")

  const tierCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) m.set(r.tier, (m.get(r.tier) ?? 0) + 1)
    return m
  }, [rows])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = rows.filter((r) => {
      if (tier && r.tier !== tier) return false
      if (lifecycle === "active" && r.status !== "active") return false
      if (lifecycle === "suspended" && r.status !== "suspended") return false
      if (lifecycle === "trialing" && r.billingStatus !== "trialing") return false
      if (q && !r.name.toLowerCase().includes(q) && !r.orgId.toLowerCase().includes(q))
        return false
      return true
    })
    const factor = dir === "asc" ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === "string" || typeof bv === "string") {
        return factor * String(av ?? "").localeCompare(String(bv ?? ""))
      }
      return factor * ((av ?? 0) - (bv ?? 0))
    })
  }, [rows, query, tier, lifecycle, sortKey, dir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setDir(key === "name" ? "asc" : "desc")
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or ID"
              className="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring sm:w-56"
            />
          </div>
          <div className="inline-flex flex-wrap items-center gap-1 rounded-full bg-muted p-1">
            {(["all", "active", "suspended", "trialing"] as Lifecycle[]).map((s) => (
              <Pill
                key={s}
                label={s}
                active={lifecycle === s}
                onClick={() => setLifecycle(s)}
              />
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          {visible.length} of {rows.length}
        </p>
      </div>

      <div className="mb-4 inline-flex flex-wrap items-center gap-1 rounded-full bg-muted p-1">
        <Pill label="All tiers" active={!tier} onClick={() => setTier(null)} count={rows.length} />
        {TIER_ORDER.filter((t) => tierCounts.has(t)).map((t) => (
          <Pill
            key={t}
            label={t}
            active={tier === t}
            onClick={() => setTier(t)}
            count={tierCounts.get(t) ?? 0}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2 md:hidden">
        {visible.map((row) => (
          <Link
            key={row.orgId}
            href={`/tenants/${row.orgId}`}
            className={cn(
              "flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10",
              row.status === "suspended" && "opacity-60",
            )}
          >
            <div className="flex items-center gap-3">
              <OrgAvatar name={row.name} seed={row.orgId} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{row.name}</span>
                <OrgKey orgId={row.orgId} className="-ml-1.5" />
              </span>
              <HealthBadge rate={row.failureRate} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <TierPill tier={row.tier} />
              <StatusPill status={row.status} />
              <LifecyclePill row={row} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
              <div>
                <div className="font-medium text-foreground tabular-nums">
                  {row.mrrInr === null ? "custom" : inr(row.mrrInr)}
                </div>
                <div>MRR</div>
              </div>
              <div>
                <div className="font-medium text-foreground tabular-nums">{inr(row.infraMtdInr)}</div>
                <div>Infra</div>
              </div>
              <div>
                <div className="font-medium text-foreground tabular-nums">
                  {row.marginInr === null ? "-" : inr(row.marginInr)}
                </div>
                <div>Margin</div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Last run {relativeTime(row.lastRunAt)} · {row.seats} seats
            </div>
          </Link>
        ))}
        {visible.length === 0 ? (
          <div className="rounded-xl bg-card py-12 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
            No tenants match these filters.
          </div>
        ) : null}
      </div>

      <div className="hidden overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10 md:block">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="border-b border-foreground/10 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <Th label="Organisation" colKey="name" {...{ activeKey: sortKey, dir, toggleSort }} />
              <th className="px-3 py-3 font-medium">Tier</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Lifecycle</th>
              <Th label="Created" colKey="createdAt" align="right" {...{ activeKey: sortKey, dir, toggleSort }} />
              <Th label="Seats" colKey="seats" align="right" {...{ activeKey: sortKey, dir, toggleSort }} />
              <Th label="MRR" colKey="mrrInr" align="right" {...{ activeKey: sortKey, dir, toggleSort }} />
              <Th label="Infra" colKey="infraMtdInr" align="right" {...{ activeKey: sortKey, dir, toggleSort }} />
              <Th label="Margin" colKey="marginInr" align="right" {...{ activeKey: sortKey, dir, toggleSort }} />
              <Th label="Health" colKey="failureRate" align="right" {...{ activeKey: sortKey, dir, toggleSort }} />
              <Th label="Last run" colKey="lastRunAt" align="right" {...{ activeKey: sortKey, dir, toggleSort }} />
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.orgId}
                className={cn(
                  "group border-b border-foreground/5 transition-colors last:border-0 hover:bg-muted/40",
                  row.status === "suspended" && "opacity-60",
                )}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Link href={`/tenants/${row.orgId}`}>
                      <OrgAvatar name={row.name} seed={row.orgId} />
                    </Link>
                    <span className="min-w-0">
                      <Link
                        href={`/tenants/${row.orgId}`}
                        className="block truncate font-medium hover:underline"
                      >
                        {row.name}
                      </Link>
                      {row.orgId === row.name ? null : (
                        <OrgKey orgId={row.orgId} className="-ml-1.5" />
                      )}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3"><TierPill tier={row.tier} /></td>
                <td className="px-3 py-3"><StatusPill status={row.status} /></td>
                <td className="px-3 py-3"><LifecyclePill row={row} /></td>
                <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                  {shortDate(row.createdAt)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{row.seats}</td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {row.mrrInr === null ? "custom" : inr(row.mrrInr)}
                </td>
                <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                  {inr(row.infraMtdInr)}
                </td>
                <td
                  className={cn(
                    "px-3 py-3 text-right tabular-nums",
                    row.marginInr !== null && row.marginInr < 0 && "text-red-600 dark:text-red-400",
                  )}
                >
                  {row.marginInr === null ? "-" : inr(row.marginInr)}
                </td>
                <td className="px-3 py-3 text-right">
                  <HealthBadge rate={row.failureRate} />
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {relativeTime(row.lastRunAt)}
                </td>
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-12 text-center text-muted-foreground">
                  No tenants match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LifecyclePill({ row }: { row: TenantTableRow }) {
  const days = trialDaysLeft(row)
  if (row.grandfathered) {
    return (
      <span className="inline-flex items-center rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-400">
        Grandfathered
      </span>
    )
  }
  if (days !== null) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        Trial · {days}d left
      </span>
    )
  }
  if (!row.billingStatus || row.billingStatus === "manual") {
    return <span className="text-xs text-muted-foreground">-</span>
  }
  const tone =
    row.billingStatus === "past_due"
      ? "bg-red-500/15 text-red-700 dark:text-red-400"
      : row.billingStatus === "active"
        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
        : "bg-muted text-muted-foreground"
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize", tone)}>
      {row.billingStatus.replace(/_/g, " ")}
    </span>
  )
}

function Th({
  label,
  colKey: key,
  align = "left",
  activeKey,
  dir,
  toggleSort,
}: {
  label: string
  colKey: SortKey
  align?: "left" | "right"
  activeKey: SortKey
  dir: "asc" | "desc"
  toggleSort: (key: SortKey) => void
}) {
  const isActive = activeKey === key
  return (
    <th className={cn("px-3 py-3 font-medium", align === "right" && "text-right")}>
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className={cn(
          "inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground",
          align === "right" && "flex-row-reverse",
          isActive && "text-foreground",
        )}
      >
        {label}
        {isActive ? (
          dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
        ) : null}
      </button>
    </th>
  )
}

function Pill({
  label,
  active,
  onClick,
  count,
}: {
  label: string
  active: boolean
  onClick: () => void
  count?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium capitalize transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      {count !== undefined ? (
        <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
      ) : null}
    </button>
  )
}

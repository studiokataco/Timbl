"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  getUserPlatformAudit,
  lookupPlatformUser,
  remintPlatformUserClaims,
  type PlatformUserLookup,
} from "@/lib/actions/platform/users"
import type { PlatformUserRow } from "@/lib/platform/queries"
import type { PlatformAuditEntry } from "@/lib/platform/schema"

type Result = { ok: boolean; error?: string }

export function UserOpsPanel({ users }: { users: PlatformUserRow[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const [user, setUser] = useState<PlatformUserLookup | null>(null)
  const [audit, setAudit] = useState<PlatformAuditEntry[]>([])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        u.memberships.some((m) => m.orgName.toLowerCase().includes(q)),
    )
  }, [users, query])

  const run = (label: string, fn: () => Promise<Result>) =>
    start(async () => {
      const res = await fn()
      if (res.ok) {
        toast.success(`${label} done`)
        router.refresh()
      } else {
        toast.error(`${label} failed: ${res.error ?? "unknown"}`)
      }
    })

  const onSelect = (email: string) =>
    start(async () => {
      setSelected(email)
      const res = await lookupPlatformUser({ email })
      if (!res.ok || !res.user) {
        toast.error(res.error ?? "Lookup failed")
        setUser(null)
        setAudit([])
        return
      }
      setUser(res.user)
      const rows = await getUserPlatformAudit(res.user.email)
      setAudit(rows)
    })

  return (
    <div className="grid items-start gap-6 lg:grid-cols-5">
      <section className="rounded-xl bg-card ring-1 ring-foreground/10 lg:col-span-3">
        <header className="flex items-center gap-2 border-b border-foreground/5 px-4 py-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            type="search"
            placeholder="Filter by name, email, or workspace"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {filtered.length}
          </span>
        </header>
        <ul className="divide-y divide-foreground/5">
          {filtered.map((u) => {
            const isActive = selected === u.email
            return (
              <li key={u.email}>
                <button
                  type="button"
                  onClick={() => onSelect(u.email)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 ${
                    isActive ? "bg-muted/60" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{u.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs text-muted-foreground">
                      {u.orgCount} {u.orgCount === 1 ? "workspace" : "workspaces"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {u.roles.join(", ")}
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
          {filtered.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">
              No users match.
            </li>
          ) : null}
        </ul>
      </section>

      <div className="flex flex-col gap-6 lg:col-span-2">
        {user ? (
          <>
            <section className="rounded-xl bg-card ring-1 ring-foreground/10">
              <header className="border-b border-foreground/5 px-4 py-3">
                <h2 className="font-heading text-sm font-semibold tracking-tight">
                  {user.email}
                </h2>
                <p className="mt-0.5 break-all text-xs text-muted-foreground">
                  Auth uid: {user.authUid ?? "none"} · Claims:{" "}
                  {user.claims ? JSON.stringify(user.claims) : "none"}
                </p>
              </header>
              <div className="px-4 py-4">
                <h3 className="mb-2 text-sm font-medium">Memberships</h3>
                {user.memberships.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No memberships.</p>
                ) : (
                  <ul className="flex flex-col gap-2 text-sm">
                    {user.memberships.map((m) => (
                      <li
                        key={`${m.organizationId}-${m.userId}`}
                        className="rounded-lg bg-muted/40 px-3 py-2"
                      >
                        <span className="font-medium">{m.orgName}</span>{" "}
                        <span className="text-muted-foreground">
                          ({m.organizationId}) · {m.role}
                          {m.active ? "" : " · inactive"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  size="sm"
                  className="mt-4"
                  disabled={pending || user.memberships.length === 0}
                  onClick={() =>
                    run("Re-mint claims", () =>
                      remintPlatformUserClaims({ email: user.email }),
                    )
                  }
                >
                  Re-mint claims
                </Button>
              </div>
            </section>

            {audit.length > 0 ? (
              <section className="rounded-xl bg-card ring-1 ring-foreground/10">
                <header className="border-b border-foreground/5 px-4 py-3">
                  <h2 className="font-heading text-sm font-semibold tracking-tight">
                    Recent audit
                  </h2>
                </header>
                <ul className="divide-y divide-foreground/5 px-4 py-2 text-sm">
                  {audit.map((row) => (
                    <li key={row.id} className="py-2">
                      <span className="font-medium">{row.action}</span>{" "}
                      <span className="text-muted-foreground">· {row.createdAt}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : (
          <section className="rounded-xl border border-dashed bg-card/40 px-4 py-10 text-center">
            <p className="text-sm font-medium">Select a user</p>
            <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
              Pick a row to inspect claims, memberships, and audit history, or to
              re-mint tokens after a repair.
            </p>
          </section>
        )}
      </div>
    </div>
  )
}

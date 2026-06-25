"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  getUserPlatformAudit,
  lookupPlatformUser,
  remintPlatformUserClaims,
  type PlatformUserLookup,
} from "@/lib/actions/platform/users"
import type { PlatformAuditEntry } from "@/lib/platform/schema"

type Result = { ok: boolean; error?: string }

export function UserOpsPanel() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [email, setEmail] = useState("")
  const [user, setUser] = useState<PlatformUserLookup | null>(null)
  const [audit, setAudit] = useState<PlatformAuditEntry[]>([])

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

  const onLookup = () =>
    start(async () => {
      const res = await lookupPlatformUser({ email: email.trim() })
      if (!res.ok || !res.user) {
        toast.error(res.error ?? "Lookup failed")
        setUser(null)
        return
      }
      setUser(res.user)
      const rows = await getUserPlatformAudit(res.user.email)
      setAudit(rows)
    })

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl bg-card ring-1 ring-foreground/10">
        <header className="border-b border-foreground/5 px-4 py-3">
          <h2 className="font-heading text-sm font-semibold tracking-tight">
            User lookup
          </h2>
        </header>
        <div className="flex flex-wrap items-center gap-2 px-4 py-4">
          <Input
            type="email"
            placeholder="user@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-9 min-w-56 flex-1"
          />
          <Button size="sm" disabled={pending || !email.trim()} onClick={onLookup}>
            Look up
          </Button>
        </div>
      </section>

      {user ? (
        <>
          <section className="rounded-xl bg-card ring-1 ring-foreground/10">
            <header className="border-b border-foreground/5 px-4 py-3">
              <h2 className="font-heading text-sm font-semibold tracking-tight">
                {user.email}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
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
                    <span className="text-muted-foreground">
                      · {row.createdAt}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
